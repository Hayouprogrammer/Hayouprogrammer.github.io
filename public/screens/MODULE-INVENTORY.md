# Imbirt tenant module inventories (verified live)
#
# Exact installed-module counts as `ir_module_module WHERE state='installed'`
# in each provisioned tenant database, captured 2026-10-10.

## t_skyline_hotel (Skyline Hotel — hospitality package) — 98 modules

account; account_add_gln; account_edi_ubl_cii; account_payment; analytic;
api_doc; auth_passkey; auth_passkey_portal; auth_signup; auth_totp;
auth_totp_mail; auth_totp_portal; barcodes; barcodes_gs1_nomenclature; base;
base_automation; base_geolocalize; base_import; base_import_module;
base_install_request; base_setup; bus; calendar; calendar_sms; digest;
eh_account_base; google_address_autocomplete; google_gmail; hide_enterprise_lite;
hms_imbirt; html_editor; http_routing; iap; iap_mail; imbirt_ai; imbirt_brand;
imbirt_dashboard; imbirt_hotel; imbirt_housekeeping; imbirt_lease;
imbirt_menu_policy; imbirt_pos_debrand; imbirt_reporting; imbirt_sale;
imbirt_tenant_client; imbirt_tenant_lockdown; imbirt_ui_fixes; iot_base; mail;
mail_bot; microsoft_outlook; muk_web_appsbar; muk_web_chatter; muk_web_colors;
muk_web_dialog; muk_web_group; muk_web_refresh; muk_web_theme; onboarding;
partner_autocomplete; payment; phone_validation; pms_account; pms_base;
pms_owner_account; pms_sale; point_of_sale; portal; pos_online_payment;
privacy_lookup; product; resource; resource_mail; rpc; sale; sale_edi_ubl;
sale_sms; sale_stock; sales_team; sms; snailmail; snailmail_account; spreadsheet;
spreadsheet_account; spreadsheet_dashboard; spreadsheet_dashboard_account;
spreadsheet_dashboard_sale; spreadsheet_dashboard_stock_account; stock;
stock_account; stock_sms; uom; utm; web; web_timeline; web_tour; web_unsplash;
workflow_engine

## t_adama_properties (Adama Properties — property package) — 88 modules

account; account_add_gln; account_edi_ubl_cii; account_payment; analytic;
api_doc; auth_passkey; auth_passkey_portal; auth_signup; auth_totp;
auth_totp_mail; auth_totp_portal; base; base_automation; base_geolocalize;
base_import; base_import_module; base_install_request; base_setup; bus;
calendar; calendar_sms; digest; eh_account_base; google_gmail;
hide_enterprise_lite; html_editor; http_routing; iap; iap_mail; imbirt_ai;
imbirt_brand; imbirt_dashboard; imbirt_hotel; imbirt_housekeeping; imbirt_lease;
imbirt_menu_policy; imbirt_property_ui; imbirt_reporting; imbirt_sale;
imbirt_tenant_client; imbirt_tenant_lockdown; imbirt_ui_fixes; mail; mail_bot;
microsoft_outlook; muk_web_appsbar; muk_web_chatter; muk_web_colors;
muk_web_dialog; muk_web_group; muk_web_refresh; muk_web_theme; onboarding;
partner_autocomplete; payment; phone_validation; pms_account; pms_base;
pms_owner_account; pms_sale; portal; privacy_lookup; product; resource;
resource_mail; rpc; sale; sale_edi_ubl; sale_management; sale_pdf_quote_builder;
sale_sms; sales_team; sms; snailmail; snailmail_account; spreadsheet;
spreadsheet_account; spreadsheet_dashboard; spreadsheet_dashboard_account;
spreadsheet_dashboard_sale; uom; utm; web; web_timeline; web_tour;
web_unsplash; workflow_engine

## Imbirt-owned modules present in each tenant

t_skyline_hotel (14): imbirt_ai, imbirt_brand, imbirt_dashboard, imbirt_hotel,
imbirt_housekeeping, imbirt_lease, imbirt_menu_policy, imbirt_pos_debrand,
imbirt_reporting, imbirt_sale, imbirt_tenant_client, imbirt_tenant_lockdown,
imbirt_ui_fixes

t_adama_properties (14): imbirt_ai, imbirt_brand, imbirt_dashboard,
imbirt_hotel, imbirt_housekeeping, imbirt_lease, imbirt_menu_policy,
imbirt_property_ui, imbirt_reporting, imbirt_sale, imbirt_tenant_client,
imbirt_tenant_lockdown, imbirt_ui_fixes

The package manifests ship 15 top-level modules each; the remaining rows are
their dependency closure (Odoo core + OCA/Muk trees).
