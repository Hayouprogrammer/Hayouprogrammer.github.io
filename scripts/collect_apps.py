#!/usr/bin/env python
"""Generate src/data/applications.json from the Imbirt repository.

The portfolio publishes an application catalog, so the catalog must be read
from the platform rather than typed by hand and left to drift.

    python scripts/collect_apps.py [--repo C:/src/ethio-erp-addons]

Reads:
  addons/imbirt_tenant_ops/data/sellable_apps.py   -> SELLABLE_MODULES
  addons/imbirt_tenant_ops/data/app_profiles.py    -> APP_PROFILES (install profiles)
  packages/*.json                                  -> industry packages

Writes:
  src/data/applications.json
"""
import ast
import io
import json
import os
import re
import sys

REPO = os.environ.get("IMBIRT_REPO", "C:/src/ethio-erp-addons")

if not os.path.isdir(REPO):
    sys.stderr.write(
        "collect_apps: %s not found.\n"
        "This script reads the ethio-erp-addons working tree and is local tooling.\n"
        "Set IMBIRT_REPO to point at it. src/data/applications.json is committed\n"
        "derived data and does not need regenerating to build or deploy.\n" % REPO
    )
    raise SystemExit(1)

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SELLABLE = os.path.join(REPO, "addons", "imbirt_tenant_ops", "data", "sellable_apps.py")
PROFILES = os.path.join(REPO, "addons", "imbirt_tenant_ops", "data", "app_profiles.py")
PACKAGES = os.path.join(REPO, "packages")

# Human names for the applications a client actually chooses. Keys are the
# module names in SELLABLE_MODULES; these are the labels the platform shows.
DISPLAY = {
    "hr": ("Human Resources", "People"),
    "payroll": ("Payroll", "People"),
    "om_account_accountant": ("Accounting", "Finance"),
    "subscription_oca": ("Subscriptions", "Finance"),
    "contract": ("Contracts", "Finance"),
    "mis_builder": ("MIS Reporting", "Finance"),
    "aos_company_bank_loan": ("Bank Loans", "Finance"),
    "sale": ("Sales", "Sales & supply"),
    "sale_management": ("Sales management", "Sales & supply"),
    "crm": ("CRM / Pipeline", "Sales & supply"),
    "purchase": ("Purchase", "Sales & supply"),
    "stock": ("Inventory", "Sales & supply"),
    "point_of_sale": ("Point of Sale", "Sales & supply"),
    "pos_restaurant": ("Restaurant POS", "Sales & supply"),
    "mrp": ("Manufacturing", "Sales & supply"),
    "quality_control_oca": ("Quality", "Sales & supply"),
    "product_multi_barcode": ("Multi-barcode products", "Sales & supply"),
    "barcodes_generator_product": ("Barcode generator", "Sales & supply"),
    "maintenance": ("Maintenance & field service", "Sales & supply"),
    "project": ("Project", "Projects & service"),
    "project_timeline": ("Project timeline", "Projects & service"),
    "helpdesk_mgmt": ("Helpdesk", "Projects & service"),
    "sign_oca": ("E-signature", "Projects & service"),
    "document_knowledge": ("Documents", "Documents"),
    "document_page": ("Pages & wiki", "Documents"),
    "website": ("Website", "Web & engagement"),
    "website_sale": ("eCommerce", "Web & engagement"),
    "website_event": ("Events", "Web & engagement"),
    "website_hr_recruitment": ("Recruitment site", "Web & engagement"),
    "website_slides": ("eLearning", "Web & engagement"),
    "survey": ("Surveys", "Web & engagement"),
    "calendar": ("Calendar", "Web & engagement"),
    "imbirt_social": ("Social publishing", "Imbirt"),
    "hms_imbirt": ("Hotel Management", "Hospitality"),
    "pms_base": ("Property Management", "Property"),
}

DOMAIN_ORDER = [
    "People",
    "Finance",
    "Sales & supply",
    "Projects & service",
    "Documents",
    "Web & engagement",
    "Hospitality",
    "Property",
    "Imbirt",
]


def read(path):
    with io.open(path, encoding="utf-8") as fh:
        return fh.read()


def parse_dict(source, name):
    """Pull a module-level dict literal out of a Python source file."""
    m = re.search(name + r"\s*=\s*\{", source)
    if not m:
        raise SystemExit("could not find %s" % name)
    start = source.index("{", m.start())
    depth = 0
    for i in range(start, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                return ast.literal_eval(source[start : i + 1])
    raise SystemExit("unbalanced braces after %s" % name)


def parse_frozenset(source, name):
    m = re.search(name + r"\s*=\s*frozenset\(", source)
    if not m:
        raise SystemExit("could not find %s" % name)
    start = source.index("(", m.end() - 1)
    depth = 0
    for i in range(start, len(source)):
        if source[i] == "(":
            depth += 1
        elif source[i] == ")":
            depth -= 1
            if depth == 0:
                inner = source[start + 1 : i]
                # Drop comment lines first: the source documents its own
                # decisions in prose, and a quoted phrase in a comment is not a
                # module name.
                inner = "\n".join(
                    ln for ln in inner.splitlines() if not ln.strip().startswith("#")
                )
                return set(re.findall(r'"([^"]+)"', inner))
    raise SystemExit("unbalanced parens after %s" % name)


sellable_src = read(SELLABLE)
profiles_src = read(PROFILES)

sellable = parse_frozenset(sellable_src, "SELLABLE_MODULES")
not_sellable = parse_frozenset(sellable_src, "NOT_SELLABLE")
profiles = parse_dict(profiles_src, "APP_PROFILES")

packages = []
if os.path.isdir(PACKAGES):
    for fn in sorted(os.listdir(PACKAGES)):
        if not fn.endswith(".json") or fn.endswith(".roles.json"):
            continue
        with io.open(os.path.join(PACKAGES, fn), encoding="utf-8") as fh:
            data = json.load(fh)
        packages.append(
            {
                "id": data.get("name"),
                "title": data.get("title"),
                "target": data.get("target"),
                "description": data.get("description"),
                "modules": len(data.get("modules", [])),
            }
        )

groups = {}
unnamed = []
for module in sorted(sellable):
    label, domain = DISPLAY.get(module, (None, None))
    if label is None:
        unnamed.append(module)
        continue
    profile = profiles.get(module, {}).get("profile", [])
    groups.setdefault(domain, []).append(
        {
            "module": module,
            "name": label,
            "installs": len(profile) + 1,  # the application itself plus its profile
            "profile": [module] + profile,
        }
    )

# An application that is only the implementation module behind a catalog row is
# sellable by policy but never a catalog row of its own.
implementation_only = [m for m in sellable if m not in DISPLAY]

out = {
    "generatedAt": None,
    "source": "addons/imbirt_tenant_ops/data/sellable_apps.py + data/app_profiles.py",
    "sellableByPolicy": len(sellable),
    "notSellable": len(not_sellable),
    "catalogApplications": sum(len(v) for v in groups.values()),
    "implementationOnly": sorted(implementation_only),
    "domainOrder": DOMAIN_ORDER,
    "groups": [
        {
            "domain": d,
            "applications": sorted(groups.get(d, []), key=lambda a: a["name"]),
        }
        for d in DOMAIN_ORDER
        if groups.get(d)
    ],
    "packages": packages,
}

out["generatedAt"] = __import__("datetime").datetime.now().isoformat()

dest = os.path.join(BASE, "src", "data", "applications.json")
os.makedirs(os.path.dirname(dest), exist_ok=True)
with io.open(dest, "w", encoding="utf-8") as fh:
    fh.write(json.dumps(out, indent=2) + "\n")

print("applications.json written")
print("  sellable by policy : %d" % out["sellableByPolicy"])
print("  catalog applications: %d" % out["catalogApplications"])
print("  never offered      : %d" % out["notSellable"])
print("  implementation-only: %s" % (", ".join(out["implementationOnly"]) or "none"))
print("  packages           : %s" % ", ".join(p["id"] for p in packages))
if unnamed:
    print("  WARNING unnamed sellable modules: %s" % ", ".join(sorted(unnamed)))
