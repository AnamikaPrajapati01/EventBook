'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

function ActiveNavLink({ href, children }: { href: string; children: string }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className="nav__link" aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Suspense
      fallback={
        <Link href={href} className="nav__link">
          {children}
        </Link>
      }
    >
      <ActiveNavLink href={href}>{children}</ActiveNavLink>
    </Suspense>
  );
}

export function Header() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand">
          Event<span className="brand__mark">Book</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink href="/">Events</NavLink>
          {user && <NavLink href="/bookings">My bookings</NavLink>}
          {user?.role === 'admin' && <NavLink href="/admin">Manage events</NavLink>}
          {!loading && !user && (
            <>
              <NavLink href="/login">Log in</NavLink>
              <NavLink href="/register">Register</NavLink>
            </>
          )}
          {user && (
            <button
              className="nav__link"
              onClick={() => {
                logout();
                router.push('/');
              }}
            >
              Log out ({user.name})
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}