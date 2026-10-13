/**
 * glossary.ts — the translation layer between the repository and a buyer.
 *
 * WHY THIS FILE EXISTS
 *
 * The site's whole credibility rests on one rule: every claim is derived from
 * the repository by scripts/collect_apps.py, never typed by hand. That rule is
 * why the numbers are trustworthy, and it is also why the page was almost
 * unusable. The names in `sellable_apps.py` are *engineering* names, chosen to
 * be unambiguous to somebody maintaining the code:
 *
 *   · a domain literally called "Imbirt", which means nothing to a buyer
 *   · "Social publishing", for an app that publishes to Telegram, Mastodon and
 *     Bluesky and also runs email and SMS marketing campaigns
 *   · "MIS Reporting", "Pages & wiki", "Multi-barcode products", "Barcode
 *     generator" — all precise, none of them how a client describes the thing
 *     they want.
 *
 * So: keep the derived name, and put a client-facing name in front of it. Both
 * are always rendered — the gloss so the buyer recognises their own business,
 * the module name so a technical reader can verify the claim against the repo.
 *
 * THE RULE FOR ADDING AN ENTRY
 *
 * A gloss is only allowed to be a *plain-language description of what the module
 * already does*, taken from its own manifest summary. Never an upgrade. If
 * `imbirt_social` only published to Telegram and Mastodon, the gloss could not
 * say "all major platforms". Nothing here adds a capability the code does not
 * have; that is the one thing that would cost more than it earns.
 */

/** Domains, as a buyer would name the part of their business. */
export const DOMAIN_GLOSS: Record<string, string> = {
  'Imbirt': 'Marketing & social',
};

/**
 * Applications, as a buyer would ask for them. Keys must match
 * `applications.json` exactly; unmatched names render as-is, so a new module in
 * the repository appears on the site on the next build even with no gloss.
 */
export const APP_GLOSS: Record<string, string> = {
  'Human Resources': 'HR, attendance, leave, expenses, timesheets, recruitment',
  Payroll: 'Payroll',
  Accounting: 'Full accounting: journals, assets, budgets, reconciliation',
  'Bank Loans': 'Bank loans & repayments',
  Contracts: 'Contracts & renewals',
  'MIS Reporting': 'Management reports & dashboards',
  Subscriptions: 'Recurring billing & subscriptions',
  'Barcode generator': 'Barcode label printing',
  'CRM / Pipeline': 'CRM & sales pipeline',
  Inventory: 'Inventory & warehouse',
  'Maintenance & field service': 'Equipment maintenance, repairs & field service',
  Manufacturing: 'Manufacturing & bills of material',
  'Multi-barcode products': 'Products with multiple barcodes',
  'Point of Sale': 'Retail point of sale',
  Purchase: 'Purchasing & suppliers',
  Quality: 'Quality checks & alerts',
  'Restaurant POS': 'Restaurant point of sale',
  Sales: 'Sales orders & quotations',
  'Sales management': 'Order templates & sales teams',
  'E-signature': 'Electronic signatures',
  Helpdesk: 'Helpdesk & support tickets',
  Project: 'Projects, to-dos & planning',
  'Project timeline': 'Gantt charts & scheduling',
  Documents: 'Document management',
  'Pages & wiki': 'Internal wiki & knowledge base',
  Calendar: 'Shared calendar',
  Events: 'Events & ticketing',
  'Recruitment site': 'Careers page & applications',
  Surveys: 'Surveys & feedback',
  Website: 'Your website',
  eCommerce: 'Online shop',
  eLearning: 'Online courses',
  'Hotel Management': 'Hotels, lodges & guest houses',
  'Property Management': 'Leases, rent rolls & owner accounts',
  'Social publishing': 'Social media, email & SMS marketing',
};

/**
 * Platform capability a client receives whether or not it has a tile in the
 * catalog. These are real addons in the repository — each line names the module
 * it comes from, so a technical reader can check it. They are listed separately
 * from the catalog because they are not sold as separate choices.
 */
export const PLATFORM_INCLUSIONS: Array<{ title: string; body: string; source: string }> = [
  {
    title: 'Executive dashboards',
    body: 'Occupancy, collections, delinquency and housekeeping, in one screen, read from the same tables the accounting writes to.',
    source: 'imbirt_dashboard',
  },
  {
    title: 'Spreadsheet dashboards',
    body: 'A native spreadsheet you can build on inside the Properties app, for the analysis a fixed report cannot answer.',
    source: 'imbirt_dashboard_spreadsheet',
  },
  {
    title: 'Rent roll & delinquency reporting',
    body: 'A live rent roll and an ageing view, straight off the ledger rather than a spreadsheet somebody maintains.',
    source: 'imbirt_reporting',
  },
  {
    title: 'Your brand, not ours',
    body: 'Login page, page titles, favicon and menus carry your name. The client never learns which platform is underneath.',
    source: 'imbirt_brand',
  },
  {
    title: 'A guest and owner portal',
    body: 'Tenants and property owners see their own statements and requests, isolated from everyone else.',
    source: 'imbirt_tenant_client',
  },
  {
    title: 'Property sales pipeline',
    body: 'Offers, bookings, deposits and agent commissions, carried through to the accounting entries.',
    source: 'imbirt_sale',
  },
  {
    title: 'The governed AI assistant',
    body: 'Ask it to pull up data and open screens. It reads freely; anything that writes stops and asks you first.',
    source: 'imbirt_ai',
  },
];
