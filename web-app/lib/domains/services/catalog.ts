export interface UniversityService {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  allowIframe: boolean;
}

// Any university can customize this configuration file to match their services!
export const universityServices: Record<string, UniversityService> = {
  moodle: {
    id: "moodle",
    name: "Moodle",
    url: "https://moodle.org/demo", // Placeholder URL
    icon: "book-open",
    description: "Access course materials and assignments",
    allowIframe: true,
  },
  seats: {
    id: "seats",
    name: "Seats",
    url: "https://example.com/seats", // Placeholder URL
    icon: "armchair",
    description: "Check seat availability in the library",
    allowIframe: true,
  },
  nest: {
    id: "nest",
    name: "Nest",
    url: "https://example.com/nest", // Placeholder URL
    icon: "graduation-cap",
    description: "Student portal and general services",
    allowIframe: true,
  },
  handshake: {
    id: "handshake",
    name: "Handshake",
    url: "https://joinhandshake.com", // Placeholder URL
    icon: "handshake",
    description: "Find jobs and internships",
    allowIframe: true,
  },
  "sticky-notes": {
    id: "sticky-notes",
    name: "Sticky Notes",
    url: "https://example.com/sticky-notes",
    icon: "sticky-note",
    description: "Create categorized study notes, clip snippets, and annotate with drawings",
    allowIframe: false,
  }
};

export function getServiceById(id: string): UniversityService | undefined {
  return universityServices[id.toLowerCase()];
}

export function getAllServices(): UniversityService[] {
  return Object.values(universityServices);
}
