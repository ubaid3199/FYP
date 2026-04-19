import type { LucideProps } from "lucide-react";
import {
  Armchair,
  BookOpen,
  BriefcaseBusiness,
  Grid2X2,
  GraduationCap,
  Map,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

const iconRegistry: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  armchair: Armchair,
  "graduation-cap": GraduationCap,
  handshake: BriefcaseBusiness,
  map: Map,
  "grid-2x2": Grid2X2,
  "sticky-note": NotebookPen,
};

export function getIconComponent(iconName: string): LucideIcon {
  return iconRegistry[iconName] ?? Grid2X2;
}

export function AppIcon({ iconName, ...props }: { iconName: string } & LucideProps) {
  const Icon = getIconComponent(iconName);
  return <Icon {...props} />;
}
