import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/login-throttle";
import { CompanyAccessBlocked, isCompanyBlocked } from "@/lib/company-access";

// Empreinte factice : la vérification prend le même temps, que le compte existe ou non.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.6Fv4zGmCnyxZZr6b6kDqZSPPHl0a";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  providers: [Credentials({ credentials: { email: {}, password: {} }, async authorize(credentials) {
    const email = String(credentials?.email || "").trim().toLowerCase(); const password = String(credentials?.password || "");
    const user = await prisma.utilisateur.findUnique({
      where: { email },
      include: { compagnie: true, filiale: true },
    });
    if (!email || isLoginBlocked(email)) return null;
    const ok = await bcrypt.compare(password, user?.motDePasse ?? DUMMY_HASH);
    if (!user || !user.actif || !ok) {
      recordLoginFailure(email);
      return null;
    }
    clearLoginFailures(email);
    // Vérifié après le mot de passe : le message n'est montré qu'au titulaire du compte.
    if (isCompanyBlocked(user.compagnie, user.role)) throw new CompanyAccessBlocked();
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
