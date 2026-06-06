import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [Credentials({ credentials: { email: {}, password: {} }, async authorize(credentials) {
    const email = String(credentials?.email || ""); const password = String(credentials?.password || "");
    const user = await prisma.utilisateur.findUnique({
      where: { email },
      include: { compagnie: true, filiale: true },
    });
    if (!user || !user.actif) return null;
    const ok = await bcrypt.compare(password, user.motDePasse);
    if (!ok) return null;
    await prisma.utilisateur.update({ where: { id: user.id }, data: { derniereConnexion: new Date() } });
    return {
      id: String(user.id),
      email: user.email,
      name: `${user.prenoms ?? ""} ${user.nom}`.trim(),
      role: user.role,
      compagnieId: user.compagnieId,
      compagnieNom: user.compagnie.nom,
      filialeId: user.filialeId,
      filialeNom: user.filiale?.nom ?? null,
    } as any;
  }} )],
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.compagnieId = (user as any).compagnieId;
        token.compagnieNom = (user as any).compagnieNom;
        token.filialeId = (user as any).filialeId;
        token.filialeNom = (user as any).filialeNom;
      }
      return token;
    },
    session({ session, token }) {
      const current = session.user as any;
      current.id = token.sub;
      current.role = token.role;
      current.compagnieId = token.compagnieId;
      current.compagnieNom = token.compagnieNom;
      current.filialeId = token.filialeId;
      current.filialeNom = token.filialeNom;
      return session;
    },
  }
});
