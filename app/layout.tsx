import "../styles/globals.css";
import React from "react";

export const metadata = {
    title: 'AstraGuardian | Global Network',
    description: 'Connect the world with distributed network infrastructure.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="dark">
            <body className="antialiased font-sans bg-background text-foreground">
                {children}
            </body>
        </html>
    )
}
