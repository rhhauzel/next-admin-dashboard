import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { users } from "./lib/placeholder-data";
import { compare } from "bcryptjs";

export const { auth, signIn, signOut} = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials){
                const user = users.find((x) => x.email === credentials.email)
            
                if(!user) return null
                const passwordMatch = await compare(credentials.password as string, user.password)
                if(passwordMatch){
                    return user
                }
                console.log('Invalid credentials')
                return null
            },
        }),
    ],
})