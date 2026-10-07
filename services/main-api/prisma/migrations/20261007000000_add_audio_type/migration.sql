CREATE TYPE "AudioType" AS ENUM ('MUSIC', 'SOUND_EFFECT');

ALTER TABLE "assets" ADD COLUMN "audioType" "AudioType";

UPDATE "assets" SET "audioType" = 'MUSIC' WHERE "category" = 'SOUND_EFFECT';
