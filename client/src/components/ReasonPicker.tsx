import { useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

const OTHER = "__other__";

interface ReasonPickerProps {
    presets: string[];
    onChange: (reason: string) => void;
    placeholder?: string;
}

// Dropdown of preset reasons with an "Other" option that reveals a free-text box.
// Emits the final reason string via onChange ("" while nothing valid is chosen),
// so the parent only needs to keep a single reason string.
export default function ReasonPicker({ presets, onChange, placeholder = "Select a reason" }: ReasonPickerProps) {
    const [selected, setSelected] = useState("");
    const [customText, setCustomText] = useState("");

    const handleSelect = (value: string) => {
        setSelected(value);
        onChange(value === OTHER ? customText.trim() : value);
    };

    const handleCustomText = (text: string) => {
        setCustomText(text);
        onChange(text.trim());
    };

    return (
        <div className="space-y-2">
            <Select value={selected} onValueChange={handleSelect}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {presets.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                            {reason}
                        </SelectItem>
                    ))}
                    <SelectItem value={OTHER}>Other (type a reason)</SelectItem>
                </SelectContent>
            </Select>

            {selected === OTHER && (
                <Textarea
                    rows={3}
                    placeholder="Type the reason"
                    value={customText}
                    onChange={(e) => handleCustomText(e.target.value)}
                />
            )}
        </div>
    );
}
