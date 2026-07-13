export type OrgRole = "admin" | "sales_rep" | "office";

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  fullName: string;
}
