"use client";
import React from "react";
import {
    TextRevealCard,
    TextRevealCardDescription,
    TextRevealCardTitle,
} from "./ui/text-reveal-card";

export function TextRevealCardPreview() {
    return (
        <div className="flex items-center justify-center bg-[#0E0E10] h-[40rem] rounded-2xl w-full">
            <TextRevealCard
                text="Search the Unseen Database"
                revealText="Find visually similar matches instantly"
            >
                <TextRevealCardTitle>
                    Upload, Analyze, Discover.
                </TextRevealCardTitle>
                <TextRevealCardDescription>
                    Hover over the card to reveal the hidden intelligence behind your image.
                </TextRevealCardDescription>
            </TextRevealCard>
        </div>
    );
}
