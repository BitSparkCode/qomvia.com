import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditGrant, PlanOverride } from "@/components/admin-actions";
import { currentAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { creditBalance } from "@/lib/visibility/credits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // 404 rather than a redirect: a signed-in merchant should not learn the page exists.
  const admin = await currentAdmin();
  if (!admin) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      createdAt: true,
      storeLinks: {
        orderBy: { createdAt: "asc" },
        select: {
          kind: true,
          verifiedAt: true,
          brandId: true,
          brand: { select: { name: true, domain: true, slug: true } },
        },
      },
    },
  });

  const brandIds = [...new Set(users.flatMap((user) => user.storeLinks.map((link) => link.brandId)))];
  const subscriptions = new Map(
    (
      await prisma.subscription.findMany({
        where: { brandId: { in: brandIds } },
        select: { brandId: true, tier: true, status: true, stripeSubscriptionId: true },
      })
    ).map((subscription) => [subscription.brandId, subscription]),
  );
  const credits = new Map(await Promise.all(brandIds.map(async (id) => [id, await creditBalance(id)] as const)));
  const products = new Map(
    (
      await prisma.product.groupBy({
        by: ["brandId"],
        where: { brandId: { in: brandIds } },
        _count: { _all: true },
      })
    ).map((row) => [row.brandId, row._count._all]),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-4xl tracking-tight">Admin</h1>
        <p className="text-muted">
          {users.length} accounts · signed in as {admin.email}. Overriding a plan writes the same subscription row
          Stripe would, so entitlements, prompt budgets and monthly credits follow immediately.
        </p>
      </header>

      {users.map((user) => (
        <section key={user.id} className="space-y-4 border border-border bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
            <h2 className="text-xl">{user.email}</h2>
            <p className="text-xs text-muted">joined {user.createdAt.toISOString().slice(0, 10)}</p>
          </div>

          {user.storeLinks.length === 0 ? (
            <p className="text-sm text-muted">No store attached.</p>
          ) : (
            <ul className="divide-y divide-border">
              {user.storeLinks.map((link) => {
                const subscription = subscriptions.get(link.brandId);
                const active = subscription?.status === "active";
                return (
                  <li key={link.brandId} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {link.brand.domain}{" "}
                        <span className="text-xs uppercase tracking-wide text-muted">
                          {link.kind === "owned" ? (link.verifiedAt ? "owned · verified" : "owned · unverified") : "watched"}
                        </span>
                      </p>
                      <p className="text-xs text-muted">
                        {active ? `${subscription?.tier} active` : (subscription?.status ?? "no subscription")}
                        {subscription?.stripeSubscriptionId ? " · Stripe" : " · manual"} ·{" "}
                        {credits.get(link.brandId) ?? 0} credits · {products.get(link.brandId) ?? 0} products ·{" "}
                        <Link href={`/site/${link.brand.slug}`} className="link-underline">
                          score page
                        </Link>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <PlanOverride
                        brandId={link.brandId}
                        userId={user.id}
                        email={user.email}
                        tier={active && subscription ? subscription.tier : "none"}
                      />
                      <CreditGrant brandId={link.brandId} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
