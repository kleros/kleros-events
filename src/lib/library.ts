/**
 * Kleros pages, docs and articles that the site recommends next to talks and events (lib/related.ts).
 * Each entry has hand-picked topics (the same words as events' topics, lib/kleros TOPICS plus "Identity")
 * and, where it is about one product, `about`: the product names in lib/related.ts ENTITIES, so a talk
 * about Curate is matched with the Curate pages first.
 *
 * Every URL was checked against blog.kleros.io/sitemap-posts.xml and docs.kleros.io/sitemap.xml on
 * 2026-11-19. To add an article: copy a line, keep the title as the blog writes it, pick 1 to 3 topics.
 */
export type ReadKind = "App" | "Guide" | "Docs" | "Article" | "Research";

export interface Read {
  id: string;
  kind: ReadKind;
  title: string;
  /** one plain sentence on what the reader gets */
  blurb: string;
  url: string;
  topics: string[];
  about?: string[];
  /** yyyy-mm, for articles; newer ones win ties */
  date?: string;
  /** a little extra for the pages a newcomer should see first */
  boost?: number;
}

const blog = (slug: string) => `https://blog.kleros.io/${slug}/`;
const docs = (path: string) => `https://docs.kleros.io/${path}`;

export const READS: Read[] = [
  // ---------- apps and products ----------
  { id: "court", kind: "App", title: "Kleros Court", blurb: "Stake PNK, get drawn as a juror and earn fees for voting with the majority.", url: "https://court.kleros.io", topics: ["Arbitration", "Jurors"], about: ["Court"], boost: 1.5 },
  { id: "curate", kind: "App", title: "Kleros Curate", blurb: "Community-curated lists and registries, with disputes settled in Kleros Court.", url: "https://curate.kleros.io", topics: ["Content moderation", "Governance", "Community"], about: ["Curate"], boost: 1 },
  { id: "escrow", kind: "App", title: "Kleros Escrow", blurb: "Pay for work and goods with a court behind the deal.", url: "https://escrow.kleros.io", topics: ["DeFi", "Smart contracts", "Legal tech"], about: ["Escrow"], boost: 1 },
  { id: "reality", kind: "Docs", title: "Reality.eth with Kleros", blurb: "Optimistic oracle answers backed by Kleros arbitration, used by prediction markets.", url: docs("developers/products/reality/overview"), topics: ["Oracles", "Prediction markets"], about: ["Reality"], boost: 0.5 },
  { id: "scout", kind: "Docs", title: "Kleros Scout", blurb: "Community-curated security data on contracts and tokens.", url: docs("developers/products/scout/overview"), topics: ["Smart contracts", "Content moderation", "Community"], about: ["Scout"] },
  { id: "poh", kind: "Docs", title: "Proof of Humanity", blurb: "A sybil-resistant registry of humans, with challenges resolved by Kleros.", url: docs("developers/products/poh/overview"), topics: ["Identity", "Governance"], about: ["PoH"] },
  { id: "foresight", kind: "Docs", title: "Kleros Foresight", blurb: "Prediction markets for making decisions, with outcomes resolved through Kleros arbitration.", url: docs("developers/products/foresight/overview"), topics: ["Prediction markets", "Research"], about: ["Foresight"] },
  { id: "governor", kind: "Docs", title: "Kleros Governor", blurb: "An on-chain contract that executes community decisions, with disputed proposals sent to Kleros Court.", url: docs("developers/products/governor/overview"), topics: ["Governance"], about: ["Governor", "Snapshot"] },
  { id: "enterprise", kind: "Docs", title: "Kleros Enterprise", blurb: "Dispute resolution for businesses and platforms, from setup to rulings.", url: docs("enterprise/enterprise"), topics: ["Legal tech", "Arbitration"], about: ["Enterprise"], boost: 0.5 },
  { id: "ai-tools", kind: "Docs", title: "Kleros for AI agents", blurb: "Tools that let AI agents open, follow and settle disputes in Kleros.", url: docs("ai-tools/overview"), topics: ["AI agents"], about: ["Agents"], boost: 1 },
  { id: "agentic-court", kind: "Docs", title: "Agentic Commerce Court", blurb: "A fast court for small disputes between AI agents, judged by AI agent jurors, with appeals to human jurors.", url: docs("ai-tools/agentic-commerce-court"), topics: ["AI agents", "Arbitration"], about: ["Agents"] },
  { id: "agent-reputation", kind: "Docs", title: "Agent reputation", blurb: "Open registries where AI agents are listed against a policy, backed by collateral and open to challenge.", url: docs("ai-tools/agent-reputation"), topics: ["AI agents", "Identity"], about: ["Agents"] },
  { id: "mcp", kind: "Docs", title: "Kleros MCP server", blurb: "Let Claude, Cursor and other AI assistants read the Kleros docs while you build an integration.", url: docs("ai-tools/mcp-server"), topics: ["AI agents", "Smart contracts"], about: ["Agents"] },
  { id: "vea-docs", kind: "Docs", title: "Vea bridge", blurb: "The optimistic bridge that carries Kleros rulings from chain to chain.", url: docs("developers/crosschain/vea-bridge"), topics: ["Smart contracts"], about: ["Vea"] },

  // ---------- how it works ----------
  { id: "how-court", kind: "Guide", title: "How Kleros Court works", blurb: "From a dispute being raised to jurors being drawn, voting and getting paid.", url: docs("court/how-it-works"), topics: ["Arbitration", "Jurors"], about: ["Court"], boost: 1.5 },
  { id: "appeals", kind: "Guide", title: "Appeals in Kleros Court", blurb: "Why every ruling can be appealed to a larger jury, and who pays for it.", url: docs("court/appeals"), topics: ["Arbitration", "Jurors"], about: ["Court"] },
  { id: "game-theory", kind: "Guide", title: "The game theory behind Kleros", blurb: "Why jurors who vote honestly come out ahead.", url: docs("concepts/game-theory"), topics: ["Jurors", "Research", "Arbitration"], boost: 0.5 },
  { id: "sortition", kind: "Guide", title: "How jurors are drawn", blurb: "Random selection weighted by stake, and why it resists bribery.", url: docs("concepts/sortition"), topics: ["Jurors", "Research"] },
  { id: "pnk", kind: "Guide", title: "The PNK token", blurb: "What PNK does in the court: staking, juror selection and governance.", url: docs("concepts/pnk-token"), topics: ["Jurors", "Governance"], about: ["Court"] },
  { id: "credible-neutrality", kind: "Guide", title: "Credible neutrality", blurb: "Why a court with no owner can be trusted by both sides of a dispute.", url: docs("concepts/credible-neutrality"), topics: ["Arbitration", "Governance"] },
  { id: "quickstart", kind: "Docs", title: "Developer quickstart", blurb: "Add Kleros dispute resolution to a contract in a few steps.", url: docs("developers/quickstart"), topics: ["Smart contracts", "Arbitration"], boost: 1 },
  { id: "arbitrable-guide", kind: "Docs", title: "Build an arbitrable app", blurb: "The contract interface a product implements to send disputes to Kleros.", url: docs("developers/arbitrable-apps/arbitrable-guide"), topics: ["Smart contracts", "Arbitration"] },
  { id: "dao-example", kind: "Docs", title: "Example: DAO governance", blurb: "A worked example of Kleros guarding a DAO's decisions.", url: docs("developers/examples/dao-governance"), topics: ["Governance", "Smart contracts"], about: ["Governor"] },
  { id: "insurance-example", kind: "Docs", title: "Example: insurance claims", blurb: "A worked example of claims settled by Kleros jurors.", url: docs("developers/examples/insurance-claim"), topics: ["DeFi", "Smart contracts"] },
  { id: "use-cases", kind: "Docs", title: "Use cases for Kleros", blurb: "Where decentralized arbitration fits: commerce, platforms, insurance and more.", url: docs("enterprise/use-cases"), topics: ["Legal tech", "Arbitration"], about: ["Enterprise"], boost: 0.5 },
  { id: "famous-cases", kind: "Docs", title: "Famous Kleros cases", blurb: "Real disputes jurors have ruled on, and what they show.", url: docs("enterprise/famous-cases"), topics: ["Arbitration", "Legal tech", "Jurors"] },
  { id: "legal", kind: "Docs", title: "The legal side of Kleros", blurb: "How Kleros rulings relate to national law and enforcement.", url: docs("enterprise/legal"), topics: ["Legal tech", "Arbitration"] },

  // ---------- articles ----------
  { id: "ai-swarm", kind: "Article", title: "The AI swarm unrest and why the agentic economy needs rule of law", blurb: "Why agents trading with agents need a court they all accept.", url: blog("the-ai-swarm-unrest-and-why-the-agentic-economy-needs-rule-of-law"), topics: ["AI agents", "Arbitration"], about: ["Agents"], date: "2026-09" },
  { id: "decade-ai", kind: "Article", title: "Justice in the algorithmic society: a decade of Kleros and artificial intelligence", blurb: "Ten years of Kleros thinking on AI, juries and automated decisions.", url: blog("justice-in-the-algorithmic-society-a-decade-of-kleros-and-artificial-intelligence"), topics: ["AI agents", "Research", "Legal tech"], about: ["Agents"], date: "2026-08" },
  { id: "guessing-judging", kind: "Research", title: "Is guessing really not judging? A reply to Eidenmüller and Hochgürtel", blurb: "A response to the academic critique of Schelling-point juries.", url: blog("is-guessing-really-not-judging-a-reply-to-eidenmuller-and-hochgurtel"), topics: ["Research", "Legal tech", "Jurors"], date: "2026-09" },
  { id: "confidential", kind: "Research", title: "Confidential data and crowdsourced dispute resolution", blurb: "How private evidence can be judged by a public jury.", url: blog("confidential-data-and-crowdsourced-dispute-resolution"), topics: ["Research", "Legal tech", "Arbitration"], date: "2026-08" },
  { id: "vea-veashi", kind: "Article", title: "Vea and VeaShi: how Kleros moves rulings across chains", blurb: "The bridges that let a ruling on one chain take effect on another.", url: blog("vea-and-veashi-how-kleros-moves-rulings-across-chains"), topics: ["Smart contracts"], about: ["Vea"], date: "2026-08" },
  { id: "foresight-s2", kind: "Article", title: "The market won this time: season 2 of the Foresight movie experiment", blurb: "Prediction markets against a curator's taste, round two.", url: blog("the-market-won-this-time-season-2-of-the-foresight-movie-experiment"), topics: ["Prediction markets", "Research"], about: ["Foresight"], date: "2026-08" },
  { id: "foresight-s1", kind: "Article", title: "What the first Foresight experiment taught us about predicting Clément's movie taste", blurb: "What a prediction market learned about one person's picks.", url: blog("what-the-first-foresight-experiment-taught-us-about-predicting-clements-movie-taste"), topics: ["Prediction markets", "Research"], about: ["Foresight"], date: "2026-06" },
  { id: "decision-markets", kind: "Article", title: "Advance decision markets: Kleros Fellowship offers up to $5,000", blurb: "A research grant for work on decision markets.", url: blog("advance-decision-markets-kleros-fellowship-offers-up-to-5-000"), topics: ["Prediction markets", "Research"], about: ["Fellowship"], date: "2026-07" },
  { id: "fellowship-10", kind: "Article", title: "The Kleros Fellowship of Justice: 10th generation applications open", blurb: "A paid research fellowship on decentralized justice.", url: blog("the-kleros-fellowship-of-justice-10th-generation-applications-open"), topics: ["Research", "Legal tech"], about: ["Fellowship"], date: "2026-07" },
  { id: "oxford", kind: "Article", title: "Decentralised justice at Oxford: law in the digital age of crowds and code", blurb: "Notes from the Kleros workshop at the University of Oxford.", url: blog("decentralised-justice-at-oxford-law-in-the-digital-age-of-crowds-and-code"), topics: ["Research", "Legal tech"], about: ["Oxford"], date: "2026-05" },
  { id: "mechanism-design", kind: "Research", title: "Mechanism design for decentralised justice: law in the age of crowds and code", blurb: "The incentive design that makes crowd juries work.", url: blog("mechanism-design-for-decentralised-justice-law-in-the-age-of-crowds-and-code"), topics: ["Research", "Jurors"], about: ["Oxford"], date: "2025-04" },
  { id: "handbook", kind: "Research", title: "Dispute Revolution: the Kleros handbook of decentralized justice", blurb: "The book on why and how decentralized justice works.", url: blog("dispute-revolution-the-kleros-handbook-of-decentralized-justice"), topics: ["Arbitration", "Legal tech", "Research"], date: "2026-09", boost: 0.5 },
  { id: "stake-curate", kind: "Article", title: "Cut compliance costs with Stake Curate, the high-quality verification tool", blurb: "Verified lists with deposits at stake, for compliance teams.", url: blog("cut-compliance-costs-with-stake-curate-the-high-quality-verification-tool"), topics: ["Content moderation", "Legal tech"], about: ["Curate"], date: "2026-01" },
  { id: "humanity-court", kind: "Guide", title: "Complete guide to staking in Kleros Humanity Court", blurb: "How to become a juror for Proof of Humanity cases.", url: blog("complete-guide-to-staking-in-kleros-humanity-court"), topics: ["Jurors", "Identity"], about: ["Court", "PoH"], date: "2026-01" },
  { id: "seer", kind: "Article", title: "Seer: crafting smarter prediction markets for a complex world", blurb: "Prediction markets on any question, settled by Reality.eth and Kleros.", url: blog("seer-crafting-smarter-prediction-markets-for-a-complex-world"), topics: ["Prediction markets", "Oracles"], about: ["Seer", "Reality"], date: "2024-10" },
  { id: "social-pm", kind: "Article", title: "Social prediction markets: political forecasting beyond the polls", blurb: "Using markets to forecast elections and public questions.", url: blog("social-prediction-markets-political-forecasting-beyond-the-polls"), topics: ["Prediction markets"], about: ["Seer"], date: "2024-10" },
  { id: "scout-article", kind: "Article", title: "Kleros Scout: community-curated security metadata", blurb: "Warnings about risky contracts, gathered and checked by the community.", url: blog("kleros-scout-community-curated-security-metadata"), topics: ["Smart contracts", "Content moderation"], about: ["Scout"], date: "2024-04" },
  { id: "v2-beta", kind: "Article", title: "Kleros 2.0 beta is here: get started", blurb: "The new court: what changed and how to try it.", url: blog("kleros-2-0-beta-is-here-get-started"), topics: ["Arbitration", "Jurors"], about: ["Court"], date: "2024-11" },
  { id: "poh-dao", kind: "Article", title: "How Kleros prevented more than $100,000 from being stolen from Proof of Humanity DAO", blurb: "A governance attack stopped by Kleros jurors, step by step.", url: blog("how-kleros-prevented-more-than-100-000-from-being-stolen-from-proof-of-humanity-dao-a-detailed-analysis"), topics: ["Governance", "Identity"], about: ["PoH", "Governor"], date: "2024-05" },
  { id: "uncommon-answers", kind: "Research", title: "Incentivizing jurors to honestly report uncommon answers", blurb: "Deposits, lazy strategies and peer prediction in juror incentives.", url: blog("incentivizing-jurors-to-honestly-report-uncommon-answers-deposit-sizes-lazy-strategies-and-peer-prediction"), topics: ["Research", "Jurors"], date: "2024-05" },
  { id: "politics-governance", kind: "Article", title: "Lessons from the history of politics for blockchain governance", blurb: "What centuries of political institutions teach DAOs.", url: blog("lessons-from-the-history-of-politics-for-blockchain-governance"), topics: ["Governance", "Research"], date: "2023-11" },
  { id: "snapshot", kind: "Article", title: "Introducing the Kleros Snapshot module", blurb: "Off-chain DAO votes executed on-chain, with Kleros as the safeguard.", url: blog("introducing-the-kleros-snapshot-module"), topics: ["Governance"], about: ["Snapshot", "Governor"], date: "2023-09" },
  { id: "algocracy", kind: "Research", title: "Overcoming algocracy: AI, blockchain and crowdsourcing for designing better dispute systems", blurb: "Where AI helps dispute resolution, and where people must stay in charge.", url: blog("overcoming-algocracy-ai-blockchain-and-crowdsourcing-for-designing-better-dispute-systems"), topics: ["AI agents", "Research", "Legal tech"], date: "2023-12" },
  { id: "mendoza", kind: "Article", title: "Kleros y el Poder Judicial de Mendoza: pioneros en justicia descentralizada", blurb: "In Spanish: the Mendoza courts' work with Kleros.", url: blog("kleros-y-el-poder-judicial-de-mendoza-pioneros-en-justicia-descentralizada"), topics: ["Legal tech", "Arbitration"], about: ["LatAm"], date: "2024-10" },
  { id: "esports", kind: "Article", title: "Decentralized justice: fighting cheating in gaming and esports", blurb: "Juries for cheating reports in games and tournaments.", url: blog("decentralized-justice-fighting-cheating-in-gaming-and-esports"), topics: ["Content moderation", "Community"], date: "2024-10" },
  { id: "harmony", kind: "Article", title: "Harmony, the Kleros mediator bot", blurb: "An AI mediator that guides both sides toward a settlement, and hands the case to Kleros if they cannot agree.", url: blog("harmony-the-kleros-mediator-bot"), topics: ["AI agents", "Arbitration"], about: ["Agents"], date: "2024-01" },
  { id: "project-2026", kind: "Article", title: "Kleros project update 2026", blurb: "The state of the Kleros project going into 2026.", url: blog("kleros-project-update-2026"), topics: ["Community", "Governance"], date: "2025-12", boost: 0.5 },
  { id: "devupdate-oct", kind: "Article", title: "Kleros development update: October 2026", blurb: "The latest month of Kleros development work.", url: blog("kleros-development-update-october-2026"), topics: ["Smart contracts", "Community"], date: "2026-11" },
  { id: "devcon-india", kind: "Article", title: "November 2026: Scout incentives, Devcon India and the agentic court proposal", blurb: "Scout rewards for the month, Kleros at Devcon India and a proposal for an agentic court.", url: blog("november-2026-scout-incentives-devcon-india-agentic-court-proposal"), topics: ["AI agents", "Community"], about: ["Scout", "Agents", "Devcon"], date: "2026-11" },
];
