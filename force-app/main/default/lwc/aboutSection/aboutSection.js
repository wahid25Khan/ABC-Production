import { LightningElement } from "lwc";
import aboutHeroImage from "@salesforce/resourceUrl/AboutABC";

const STAFF = [
  {
    id: 1,
    name: "Colleen Pintozzi",
    title: "Owner and Chief Executive Officer",
    image: null
  },
  {
    id: 2,
    name: "Devin Pintozzi",
    title: "Chief Operating Officer",
    image: null
  },
  {
    id: 3,
    name: "Lauren Kennedy",
    title: "Marketing & Technical Operations Director",
    image: null
  },
  {
    id: 4,
    name: "Felipe Garrido Roman",
    title: "Creative Director",
    image: null
  },
  { id: 5, name: "Jenny Gale", title: "Senior Account Executive", image: null },
  {
    id: 6,
    name: "Michele Lantz",
    title: "Senior Account Executive",
    image: null
  },
  {
    id: 7,
    name: "Glenn Davenport",
    title: "North & South Carolina Account Executive",
    image: null
  },
  {
    id: 8,
    name: "Debbie Price",
    title: "Arkansas & Louisiana Account Executive",
    image: null
  },
  {
    id: 9,
    name: "Rodney Adams",
    title: "Senior Account Executive",
    image: null
  },
  {
    id: 10,
    name: "Laura Riffle",
    title: "Georgia Account Executive",
    image: null
  },
  {
    id: 11,
    name: "ABC Sales Team",
    title: "Sales and Customer Service",
    image: null
  },
  {
    id: 12,
    name: "David Pintozzi",
    title: "Georgia Account Executive",
    image: null
  },
  {
    id: 13,
    name: "Danielle Pintozzi",
    title: "Alabama Account Executive",
    image: null
  },
  {
    id: 14,
    name: "Elizabeth Hatfield",
    title: "Oklahoma Account Executive",
    image: null
  },
  {
    id: 15,
    name: "Lindsey Cohn",
    title: "Alabama Account Executive",
    image: null
  },
  {
    id: 16,
    name: "Derek Pintozzi",
    title: "Virginia Account Executive",
    image: null
  },
  { id: 17, name: "Zack Black", title: "Production Manager", image: null },
  { id: 18, name: "Grant Whaley", title: "Content Director", image: null }
];

const ABC_CARES = [
  {
    id: 1,
    title: "Henry Arthur Callis Education Foundation",
    text: "Supporting educational initiatives for underserved communities through scholarships, mentorship programs, and access to quality learning resources.",
    image: null
  },
  {
    id: 2,
    title: "Sister-to-Sister Summit",
    text: "Empowering young women through educational workshops, networking opportunities, and community leadership development programs.",
    image: null
  },
  {
    id: 3,
    title: "Union Parish High School",
    text: "Partnering with local schools to provide resources, curriculum support, and quality educational materials that help students succeed.",
    image: null
  },
  {
    id: 4,
    title: "Proud sponsor of the ATL Science Fest",
    text: "Celebrating STEM education and inspiring the next generation of scientists and innovators in Atlanta and beyond.",
    image: null
  }
];

const ENVIRONMENT = [
  {
    id: 1,
    title: "Recycling",
    text: "ABC is committed to responsible waste management. We recycle paper, packaging, and electronic waste wherever possible, reducing our environmental footprint across all operations.",
    image: null
  },
  {
    id: 2,
    title: "Energy Conservation",
    text: "We actively reduce energy consumption in our offices and production facilities by using energy-efficient equipment, optimizing workflows, and implementing smart energy-saving practices.",
    image: null
  }
];

function getInitials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}

export default class AboutSection extends LightningElement {
  heroImage = aboutHeroImage;

  get staffList() {
    return STAFF.map((s) => ({ ...s, initials: getInitials(s.name) }));
  }

  get abcCaresList() {
    return ABC_CARES;
  }

  get environmentList() {
    return ENVIRONMENT;
  }

  handleNavClick(evt) {
    evt.preventDefault();
    const anchor = evt.currentTarget.dataset.anchor;
    const target = this.template.querySelector(`[data-section="${anchor}"]`);
    if (!target) return;

    const stickyNavOffset = 175; // site header (~125px) + section nav (~45px) + buffer
    const y =
      target.getBoundingClientRect().top + globalThis.scrollY - stickyNavOffset;
    globalThis.scrollTo({ top: y, behavior: "smooth" });
  }
}
