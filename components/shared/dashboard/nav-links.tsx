'use client'

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Files, HomeIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
    { name: 'Home', href: '/dashboard', icon: HomeIcon },
    { name: 'Invoices', href: '/cashboard/invoices', icon: Files},
    { name: 'Customers', href: '/cashboard/customers', icon: UsersIcon}
]

export default function NavLinks() {
    const pathname = usePathname()

    return (
        <>
            {links.map((link) => {
                const LinkIcon = link.icon
                return (
                    <Link
                        key={link.name}
                        href={link.href}
                        className={cn(
                            buttonVariants({variant: 'ghost'}),
                            'justfy-start',
                            pathname === link.href ? '' : 'text-muted-foreground'
                        )}
                    >
                        <LinkIcon className="mr-2 h-6 w-6" />
                        <span className="hidden md:block">{link.name}</span>
                    </Link>
                )
            })}
        </>
    )
}