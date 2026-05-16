import { LightningElement } from "lwc";

const HERO_EPISODE = {
  title: 'ABC Testimonial | Rochelle Brown | NCASA 2026',
  date: '5/7/2026',
  description:
    'A missed question should not be a dead end; it should be a map. We dig into what makes standards-based textbooks and assessments feel genuinely helpful for students and sustainable for teachers, using American Book Company resources as the jumping-off point.\n\nWebsite: spotlight4success.com',
  videoUrl: 'https://www.youtube.com/embed/EZ59o08dz6o'
};

const PLATFORM_LINKS = [
  {
    label: 'Apple',
    href: 'https://podcasts.apple.com/us/podcast/spotlight-4-success/id1785946954'
  },
  {
    label: 'Spotify',
    href: 'https://open.spotify.com/show/0ennSjZ6MeuYnUjn8PzbE3'
  },
  {
    label: 'iHeart',
    href: 'https://www.iheart.com/podcast/269-spotlight-4-success-240047591/'
  },
  {
    label: 'Amazon',
    href: 'https://music.amazon.com/podcasts/1496b321-d48c-4038-a259-c527f8d09761'
  },
  {
    label: 'Youtube',
    href: 'https://www.youtube.com/playlist?list=PLwSaUY7ZNJH5_8W8jA8zw-H1_Q29voR3Z'
  }
];

const PREVIOUS_EPISODES = [
  {
    title: 'Spotlight 4 Success | "Leading with Learning" | NCASA 26',
    date: '5/5/2026',
    description:
      'A single conference hallway can tell you a lot about what educators are carrying and what they still hope to build. From the NCASA conference in Wilmington, North Carolina, we sit down with Rochelle Brown, a CMS biology teacher with 26 years in education and a North Carolina Principal Fellow preparing for a full-year internship at Croft Community Schools in Charlotte. She talks candidly about the mix of excitement and nerves that comes with stepping toward school leadership and why being part of a cohort and a strong university program matters when you\'re trying to grow.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/syfo8-juBkc'
  },
  {
    title: 'Spotlight 4 Success | "Leading with Learning" | NCASA 26',
    date: '5/5/2026',
    description:
      'We\'re recording from the NCASA conference in Wilmington, North Carolina, and we keep hearing the same challenge from school and district leaders: students need more support, but schedules and staffing are already stretched thin. So we sat down with Rene and Connie from Book Nook to get specific about what scalable high impact tutoring can look like when it\'s built for real schools, real constraints, and real outcomes.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/q7vmwn0UL2I'
  },
  {
    title: 'Spotlight 4 Success | "How Schools Get Real Support" | NCASA 26',
    date: '5/4/2026',
    description:
      'We\'re recording from the NCASA conference in North Carolina, and we sit down with Taylor Simmons, Director of Creative Design at Achievable Dream Urban Learning Leadership Center (AADULLC). If you\'ve ever wondered what real school improvement looks like when it\'s tailored to a district\'s actual needs, this conversation gets specific fast. Taylor breaks down how AADULLC operates as an education consulting partner, building customizable K-12 learning solutions that go beyond one-size-fits-all programs.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/h2tA_psOuTM'
  },
  {
    title: 'Spotlight 4 Success | "Who Do You Become When You Lead?" | NCASA 26',
    date: '5/4/2026',
    description:
      'We\'re recording from the NCASA Conference in Wellington, North Carolina, and we sit down with Ashley, a fifth-grade teacher from Chapel Hill-Carrboro City Schools who\'s stepping into a new season of education leadership. After 14 years in the classroom, she\'s now a principal fellow through North Carolina Central, preparing for an administrator internship next year. That transition brings a big question: how do you move from being responsible for one room of learners to leading adults, systems, and school-wide success?\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/6KagWfw9BpE'
  },
  {
    title: 'Spotlight 4 Success | "Future-Ready School Leadership" | NCASA 26',
    date: '4/29/2026',
    description:
      'Leadership doesn\'t start the day you get the title. It starts in the rooms where you admit what you still need to learn, then go get it. From the NCASA conference in Wilmington, North Carolina, I sit down with Tanika and Tony, two Wake County Public Schools educators preparing for the next step as principal fellows connected to North Carolina Central University through CCP3 and their MSA pathway.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/_-g_962CsU0'
  },
  {
    title: 'Spotlight 4 Success | "How To Turn Pressure Into A Diamond" | NCASA 26',
    date: '4/29/2026',
    description:
      'A surprise meetup at NCASA turns into a deep dive on what values based leadership looks like when you actually practice it every day. We sit down with Gina Watts, VP of U.S. Student Transformation at Growing Leaders, and Molly from the student transformation team, to talk about the Maxwell Leadership principles behind their work and why those principles still matter in real schools with real constraints.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/aYjB_SZAaF0'
  },
  {
    title: 'Spotlight 4 Success | "Paid Principal Residency, Real Leadership" | NCASA 26',
    date: '4/28/2026',
    description:
      'A paid principal residency sounds almost too good to be true, but North Carolina is doing it and doing it with real rigor. From the floor of the NCASA Conference in Wellington, we sit down with Lauren, director of the North Carolina Principal Fellows Program, to unpack how the state is strengthening school leadership by investing in a clear pathway from educator to administrator.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/7U6Io8R89DA'
  },
  {
    title: 'Spotlight 4 Success | "When Recognition Becomes Instant" | NCASA 26',
    date: '4/27/2026',
    description:
      'A student prevents a fight before it starts, and a principal turns it into a moment the whole class will remember. That\'s the kind of fast, specific recognition that can shift school culture, and it\'s the heart of our conversation from the NCASA conference in Wilmington, North Carolina with Dean Cook, Sales Manager at Presentation Solutions.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/FYbrU37jNPU'
  },
  {
    title: 'Spotlight 4 Success | "Leading Through Educational Technology" | KAST 26',
    date: '4/22/2026',
    description:
      'Educational leadership can feel like a mystery from the outside, so we wanted to make it concrete. We talk with Jessica, a vice president in a statewide education technology organization, about what her role looks like day to day, what she\'s learning on the board, and how she\'ll step into the president role next. Along the way, we get into why consistent communication like newsletters matters for keeping schools informed about edtech trends and what\'s changing across a state.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/ayQvyScPz0k'
  },
  {
    title: 'Spotlight 4 Success | "3D Printing In Elementary Schools" | KAST 26',
    date: '4/22/2026',
    description:
      'You can feel it in the hallway conversations at KAST: schools are not asking whether technology belongs in the classroom anymore. The real question is how to make it matter. From Louisville, Kentucky, I sit down with digital learning coaches Erica and Sandy to unpack what it takes to support teachers when devices, apps, and expectations keep changing.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/9JzogbMK-cI'
  },
  {
    title: 'Spotlight 4 Success | "Why K-12 Districts Choose Byte Speed PCs" | KAST 26',
    date: '4/21/2026',
    description:
      'A school device rollout can look perfect on paper and still fail in the real world if support is slow, warranties are short, and deployment is a slog. That\'s why we sat down with Garrett, an account manager at Byte Speed, to talk about what actually makes K-12 IT feel smooth for districts, teachers, and students. Byte Speed has been working with Kentucky schools for decades, and Garrett shares what they listen for when they meet districts at conferences: the everyday pain points behind "we need computing solutions."\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/7Bs80YCpa6s'
  },
  {
    title: 'Spotlight 4 Success | "The Tiny Box That Ends HDMI Chaos" | KAST 26',
    date: '4/21/2026',
    description:
      'A classroom should not feel like a different tech puzzle every time you walk into a new room, yet that\'s the reality in many schools with a mix of projectors, older monitors, and newer interactive flat panels. From the KAST conference in Louisville, Kentucky, we sit down with Andrew, AirTame\'s Education East territory manager, to talk about a simple idea with big impact: make screen sharing consistent so teachers can spend less time troubleshooting and more time teaching.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/AakvhFeaIhs'
  },
  {
    title: 'Spotlight 4 Success | "How Schools Can Stretch Their Chromebooks" | KAST 26',
    date: '4/20/2026',
    description:
      'Chromebooks are everywhere in K 12, but keeping them working is the part no one advertises. From the CAST Conference in Louisville 2026, we sit down with Kendal Shomura from Vivacity Tech to talk about what it really takes to keep devices in students\' hands without burning out your IT team or blowing up your budget.\n\nWebsite: spotlight4success.com',
    videoUrl: 'https://www.youtube.com/embed/G4XvSINSPQA'
  }
];

export default class PodcastPage extends LightningElement {
  heroEpisode = HERO_EPISODE;

  platformLinks = PLATFORM_LINKS.map((link, index) => ({
    ...link,
    key: `platform-${index}`,
    separator: index < PLATFORM_LINKS.length - 1
  }));

  previousEpisodes = PREVIOUS_EPISODES.map((episode, index) => ({
    ...episode,
    key: `episode-${index}`
  }));

  iframeAllow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

  pageSize = 4;
  currentPage = 1;

  get totalPages() {
    return Math.ceil(this.previousEpisodes.length / this.pageSize);
  }

  get paginatedEpisodes() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.previousEpisodes.slice(start, end);
  }

  get isFirstPage() {
    return this.currentPage === 1;
  }

  get isLastPage() {
    return this.currentPage >= this.totalPages;
  }

  get currentPageLabel() {
    return `Page ${this.currentPage} of ${this.totalPages}`;
  }

  handlePrevPage() {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  handleNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }
}