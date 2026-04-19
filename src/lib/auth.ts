import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { normalizePlatformRole, type PlatformRole } from '@/lib/roles';

type AuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: PlatformRole;
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        await dbConnect();
        const user = await User.findOne({ email: credentials.email }).select("+password");

        if (!user) {
          throw new Error("No user found with this email in the database.");
        }

        // Ideally checking bcrypt against user.password from legacy Streamlit system logic
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password as string);
        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: normalizePlatformRole(user.role),
        } as AuthUser;
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.APP_SECRET_KEY, // Extracted from .env payload
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = normalizePlatformRole((user as AuthUser).role);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = normalizePlatformRole(token.role);
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
  }
};
