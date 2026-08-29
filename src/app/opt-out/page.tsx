import type { Metadata } from "next";
import { OptOutForm } from "@/components/opt-out-form";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Opt out of public scoring",
  description: "Store operators can remove their public agent-readiness page and stop future scans.",
  alternates: { canonical: absoluteUrl("/opt-out") },
  robots: { index: false },
};

export default function OptOutPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Opt out</h1>
      <p className="text-muted">
        Enter the domain and an email address at that domain. We remove the public page, stop future scans and keep the
        domain on the exclusion list.
      </p>
      <OptOutForm />
      <p className="text-xs text-muted">
        You can also block <code>QomviaBot</code> in robots.txt, which stops the crawl but does not remove an
        existing page.
      </p>
    </div>
  );
}
