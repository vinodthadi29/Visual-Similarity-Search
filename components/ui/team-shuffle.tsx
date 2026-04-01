"use client";

import { TestimonialCard } from "@/components/ui/testimonial-cards";
import { useState } from "react";

const teamMembers = [
    {
        id: 11,
        testimonial: "Leading the machine learning initiatives and optimizing our similarity algorithms.",
        author: "Member Name 1 - Machine Learning Lead"
    },
    {
        id: 12,
        testimonial: "Ensuring the backend architecture is robust and our APIs are lightning fast.",
        author: "Member Name 2 - Backend & API Developer"
    },
    {
        id: 13,
        testimonial: "Designing premium user interfaces that make complex data easy to understand.",
        author: "Member Name 3 - Frontend & UI Designer"
    },
    {
        id: 14,
        testimonial: "Managing our massive image datasets and scaling our compute infrastructure.",
        author: "Member Name 4 - Data & Systems Engineer"
    }
];

export function TeamShuffle() {
    const [positions, setPositions] = useState(["front", "middle", "back", "extra"]);

    const handleShuffle = () => {
        const newPositions = [...positions];
        newPositions.unshift(newPositions.pop()!);
        setPositions(newPositions);
    };

    return (
        <div className="grid place-content-center overflow-hidden bg-slate-950 px-8 py-24 text-slate-50 min-h-[600px] h-full w-full">
            <div className="relative -ml-[100px] h-[450px] w-[350px] md:-ml-[175px]">
                {teamMembers.map((member, index) => (
                    <TestimonialCard
                        key={member.id}
                        {...member}
                        handleShuffle={handleShuffle}
                        position={positions[index]}
                    />
                ))}
            </div>
        </div>
    );
}
