import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AssetCategory, ListingType } from "@prisma/client";

const VALID_CATEGORIES: AssetCategory[] = [
    "THREE_D_MODEL",
    "IMAGE",
    "VIDEO",
    "SOUND_EFFECT",
    "FONT",
    "ANIMATION",
];

const VALID_LISTING_TYPES: ListingType[] = ["TRADITIONAL", "BLOCKCHAIN"];

export async function createAsset(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { title, description, category, listingType, isAiGenerated } = req.body;

    if (!title || !category || !listingType) {
        res.status(400).json({ error: "title, category, and listingType are required" });
        return;
    }

    if (!VALID_CATEGORIES.includes(category)) {
        res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
        return;
    }

    if (!VALID_LISTING_TYPES.includes(listingType)) {
        res.status(400).json({ error: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}` });
        return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
        res.status(404).json({ error: "User profile not found" });
        return;
    }

    const asset = await prisma.asset.create({
        data: {
            sellerId: userId,
            title,
            description,
            category,
            listingType,
            isAiGenerated: Boolean(isAiGenerated),
        },
    });

    res.status(201).json(asset);
}
