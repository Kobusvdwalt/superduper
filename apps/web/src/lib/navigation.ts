type NavItem = { label: string; to: string; built: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const NAVIGATION: NavGroup[] = [
  {
    label: "Health",
    items: [
      { label: "Overview", to: "/health", built: true },
      { label: "Records", to: "/health/records", built: true },
      { label: "Sleep", to: "/health/sleep", built: true },
      { label: "Workouts", to: "/health/workouts", built: true },
    ],
  },
  {
    label: "Other domains",
    items: [
      { label: "Finance", to: "/finance", built: false },
      { label: "Commerce", to: "/commerce", built: false },
      { label: "Movement", to: "/movement", built: false },
      { label: "Work", to: "/work", built: false },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Clients", to: "/settings/clients", built: true },
      { label: "This device", to: "/settings/device", built: true },
      { label: "Developer", to: "/settings/developer", built: true },
    ],
  },
];
