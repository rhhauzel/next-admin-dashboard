'use server'

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function authenticate(
    prevState: string | undefined,
    formData: FormData
){
    try{
        await signIn('credentails', formData)
    }catch (error){
        if(error instanceof AuthError) {
            switch(error.type){
                case 'CredentialsSignin':
                    return 'Invalid credentails.'
                default:
                    return 'Something went wrong.'
            }
        }
        throw error
    }
}