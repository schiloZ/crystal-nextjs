import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Toaster } from "@/components/toaster";
export const metadata: Metadata = { title: "CRYSTAL Audit Santé", description: "Audit de gestion des gestionnaires santé" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="fr"><body>{children}<Suspense><Toaster /></Suspense></body></html>; }
