"use client";

import { WarningGraphic } from "@/components/ui/warning-graphic";

export default function WarningDemo() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <WarningGraphic
                width={600}
                height={230}
                enableAnimations={true}
                animationSpeed={1.5}
                className="drop-shadow-lg"
            />
        </div>
    );
}
