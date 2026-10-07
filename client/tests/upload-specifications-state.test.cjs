const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
    const exports = {};
    const code = ts.transpileModule(readFileSync(join(__dirname, '../src', file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    runInNewContext(code, { exports, require: name => dependencies[name] });
    return exports;
}
const specifications = load('lib/assetSpecifications.ts');
const detection = load('lib/detectAssetFormat.ts', { './assetSpecifications': specifications });
const { specificationSourceKey, uploadSpecificationDefaults } = load('lib/uploadSpecificationsState.ts', {
    './assetSpecifications': specifications, './detectAssetFormat': detection,
});
const file = (id, extension, metadata = {}) => ({
    id, purpose: 'ORIGINAL', fileUrl: `https://bucket.test/source-${id}.${extension}`,
    fileType: 'application/octet-stream', fileSize: 20, ...metadata,
});
const asset = (category, files, technicalSpecifications) => ({ id: 1, category, files, technicalSpecifications });

for (const [category, formats] of Object.entries(specifications.FORMAT_OPTIONS)) {
    test(`${category}: replacing a source resets its format instead of restoring the old selection`, () => {
        const old = asset(category, [file(1, formats[0].value)], { formats: [formats[0].value] });
        const replacement = { ...old, files: [file(2, formats[1].value)] };
        assert.notEqual(specificationSourceKey(old), specificationSourceKey(replacement));
        assert.equal(uploadSpecificationDefaults(replacement, false).format, formats[1].value);
        // Reopening a draft also rejects a saved format absent from current sources.
        assert.equal(uploadSpecificationDefaults(replacement).format, formats[1].value);
    });
}
test('3D to image: newly loaded image restores format and dimensions without a page refresh', () => {
    const old = asset('THREE_D_MODEL', [file(1, 'glb')], { formats: ['glb'] });
    const pending = asset('IMAGE', [], {});
    const refreshed = asset('IMAGE', [file(2, 'JPG', { fileType: 'image/jpeg', width: 900, height: 1200 })], {});
    assert.notEqual(specificationSourceKey(old), specificationSourceKey(pending));
    assert.notEqual(specificationSourceKey(pending), specificationSourceKey(refreshed));
    const defaults = uploadSpecificationDefaults(refreshed, false);
    assert.equal(defaults.format, 'jpeg');
    assert.equal(defaults.orientation, 'portrait');
    assert.equal(defaults.measurements.width, '900');
    assert.equal(defaults.measurements.height, '1200');
});
test('replacing visual and timed sources clears stale saved metadata', () => {
    for (const [category, extension, mime] of [['IMAGE', 'png', 'image/png'], ['VIDEO', 'mp4', 'video/mp4'], ['SOUND_EFFECT', 'wav', 'audio/wav']]) {
        const changed = asset(category, [file(2, extension, { fileType: mime, width: 100, height: 200, durationSeconds: 4, frameRate: 24 })],
            { formats: [extension], orientation: 'landscape', width: 1920, height: 1080, durationSeconds: 90, frameRate: 60 });
        const defaults = uploadSpecificationDefaults(changed, false);
        assert.equal(defaults.measurements.width, '100');
        assert.equal(defaults.measurements.durationSeconds, '4');
        assert.equal(defaults.measurements.frameRate, '24');
        assert.equal(defaults.orientation, 'portrait');
        changed.files = [file(3, extension)];
        const missingMetadata = uploadSpecificationDefaults(changed, false);
        assert.equal(missingMetadata.measurements.width, '');
        assert.equal(missingMetadata.measurements.durationSeconds, '');
    }
});
test('unchanged sources retain valid saved settings; previews and file order do not reset edits', () => {
    const original = asset('IMAGE', [file(1, 'png'), file(2, 'jpg')], { formats: ['jpeg'], width: 300, height: 200, orientation: 'landscape' });
    const previewChange = { ...original, files: [...original.files].reverse().concat({ ...file(3, 'png'), purpose: 'PREVIEW' }) };
    assert.equal(specificationSourceKey(original), specificationSourceKey(previewChange));
    assert.equal(uploadSpecificationDefaults(original).format, 'jpeg');
    assert.equal(uploadSpecificationDefaults(original).measurements.width, '300');
    const copiedPreview = { ...original, files: original.files.map(f => ({ ...f, previewUrl: 'https://bucket.test/public-preview' })) };
    assert.equal(specificationSourceKey(original), specificationSourceKey(copiedPreview));
});
test('source metadata changes reset defaults even when the file ID stays the same', () => {
    const original = asset('VIDEO', [file(1, 'mp4')], {});
    const refreshed = { ...original, files: [file(1, 'mp4', { durationSeconds: 10 })] };
    assert.notEqual(specificationSourceKey(original), specificationSourceKey(refreshed));
});
test('ZIP-only bundles keep manual format selection and never infer ZIP as an asset format', () => {
    for (const category of ['THREE_D_MODEL', 'ANIMATION']) {
        const bundle = asset(category, [file(1, 'zip')], { formats: ['fbx'] });
        assert.equal(uploadSpecificationDefaults(bundle).format, 'fbx');
        assert.equal(uploadSpecificationDefaults(bundle, false).format, '');
        bundle.files.push(file(2, 'glb'));
        assert.equal(uploadSpecificationDefaults(bundle, false).format, 'glb');
    }
});
for (const hook of ['useUpdateAsset', 'useUploadAssetFile', 'useDeleteAssetFile']) {
    test(`${hook} keeps mutation pending until the asset refresh completes`, async () => {
        let finishRefresh;
        const refresh = new Promise(resolve => { finishRefresh = resolve; });
        const queryClient = { invalidateQueries: ({ queryKey }) => queryKey[0] === 'asset' ? refresh : Promise.resolve() };
        const hooks = load('hooks/useAsset.ts', {
            '@tanstack/react-query': { useQueryClient: () => queryClient, useMutation: config => config },
            '../services/assetService': {},
        });
        const mutation = hooks[hook]();
        let finished = false;
        const completion = Promise.resolve(mutation.onSuccess({}, { assetId: 1 })).then(() => { finished = true; });
        await Promise.resolve();
        assert.equal(finished, false);
        finishRefresh(); await completion;
        assert.equal(finished, true);
    });
}
for (const failsRefresh of [false, true]) {
    test(`Step 1 ${failsRefresh ? 'stays on the form if refresh fails' : 'opens Step 2 only after the uploaded file data loads'}`, async () => {
        let finishRefresh, signalRefresh;
        const refreshStarted = new Promise(resolve => { signalRefresh = resolve; });
        const freshAsset = new Promise((resolve, reject) => { finishRefresh = failsRefresh ? reject : resolve; });
        const current = asset('IMAGE', [], {});
        const picked = { name: 'picture.png', type: 'image/png', size: 20, lastModified: 1 };
        let stateIndex = 0, advanced = false, errorMessage;
        const details = { title: 'Picture', category: 'IMAGE', description: '', isAiGenerated: false };
        const hooks = {
            useCreateAsset: () => ({}),
            useUpdateAsset: () => ({ mutateAsync: async () => current }),
            useUploadAssetFile: () => ({ mutateAsync: async () => file(2, 'png') }),
            useDeleteAssetFile: () => ({ isPending: false }),
        };
        const component = load('components/marketplace/UploadDetailsStep.tsx', {
            react: {
                useRef: () => ({ current: null }),
                useState: initial => {
                    const index = stateIndex++;
                    return [index === 1 ? [picked] : initial, value => { if (index === 4) errorMessage = value; }];
                },
            },
            'react/jsx-runtime': require('react/jsx-runtime'),
            'react-router-dom': {}, 'lucide-react': {},
            'react-hook-form': {
                useForm: () => ({ register: () => ({}), control: {}, setValue() {}, handleSubmit: fn => () => fn(details), formState: { errors: {} } }),
                useWatch: ({ name }) => details[name],
            },
            '@hookform/resolvers/zod': { zodResolver() {} }, zod: require('zod'),
            '@tanstack/react-query': {
                useQueryClient: () => ({ fetchQuery: () => { signalRefresh(); return freshAsset; } }),
            },
            '../../services/assetService': { getAsset: async () => current },
            '../../hooks/useAsset': hooks,
            '../../lib/errors': { getErrorMessage: error => error.message },
            '../../lib/assetSpecifications': specifications,
            '../ui/button': {}, '../ui/input': {}, '../ui/label': {}, '../ui/textarea': {}, '../ui/select': {}, '../ui/progress': {},
        });
        const form = component.default({ asset: current, onSaved: () => { advanced = true; } });
        const completion = form.props.onSubmit();
        await refreshStarted;
        assert.equal(advanced, false);
        finishRefresh(failsRefresh ? new Error('Could not load updated draft') : { ...current, files: [file(2, 'png')] });
        await completion;
        assert.equal(advanced, !failsRefresh);
        if (failsRefresh) assert.equal(errorMessage, 'Could not load updated draft');
    });
}
