export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  body: string[]
  publishedAt: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "best-dog-food-2026-buying-guide",
    title: "Best Dog Food in 2026: A Complete Buying Guide",
    excerpt: "How to choose the right dog food by life stage, breed size and budget — plus what to actually check on the label.",
    publishedAt: "2026-01-15",
    body: [
      "Choosing the best dog food starts with your dog's life stage. Puppies need higher protein and fat for growth, adult dogs need balanced maintenance nutrition, and senior dogs often benefit from lower-calorie, joint-supporting formulas.",
      "Look past the marketing on the front of the bag and check the guaranteed analysis and ingredient list. Real animal protein should be one of the first ingredients, and the food should carry an AAFCO nutritional adequacy statement for your dog's life stage.",
      "Grain-free isn't automatically better — it's a good choice for dogs with diagnosed grain sensitivities, but most dogs digest whole grains just fine. Talk to your vet before making a major diet change, and transition gradually over 7–10 days to avoid stomach upset.",
      "Budget matters too. A higher price doesn't always mean better nutrition, but very cheap foods often rely on fillers and lower-quality protein sources. PETORA's Pet Profile tool can match a food to your dog's breed, age, weight and budget in under a minute.",
    ],
  },
  {
    slug: "best-cat-food-for-every-life-stage",
    title: "Best Cat Food for Every Life Stage",
    excerpt: "Kitten, adult and senior cats have different nutritional needs — here's what to feed at each stage.",
    publishedAt: "2026-01-22",
    body: [
      "Cats are obligate carnivores, meaning they need animal protein to thrive — look for real meat, poultry or fish as the first ingredient on any cat food label.",
      "Kittens need calorie-dense, protein-rich food to support rapid growth, typically until around 12 months old. Adult cats do well on balanced maintenance diets, while senior cats often benefit from formulas that support kidney and joint health.",
      "Wet food adds hydration, which matters a lot for cats prone to urinary issues, while dry food is convenient and helps with dental health. Many owners feed a mix of both.",
      "Indoor cats burn fewer calories than outdoor cats, so an indoor-formula food with added fiber for hairball control and weight management is often a smart choice.",
    ],
  },
  {
    slug: "puppy-food-feeding-schedule",
    title: "Puppy Food 101: What and How Often to Feed",
    excerpt: "A practical feeding schedule for puppies from 8 weeks to 12 months, plus what to look for in puppy formulas.",
    publishedAt: "2026-02-03",
    body: [
      "Puppies under 6 months typically need 3–4 small meals a day to support their fast metabolism and growth. From 6 to 12 months, most puppies can transition to twice-daily feeding.",
      "Puppy food should be formulated specifically for growth — look for higher protein and fat content, DHA for brain development, and appropriate calcium and phosphorus levels, especially for large-breed puppies.",
      "Large-breed puppies grow fastest and are prone to joint issues if they grow too quickly, so a large-breed puppy formula with controlled calorie and mineral content is worth the extra label-reading.",
      "Always provide fresh water alongside meals, and resist the urge to free-feed puppies — a consistent schedule makes house-training easier and helps you spot appetite changes early.",
    ],
  },
  {
    slug: "kitten-food-and-litter-box-basics",
    title: "Kitten Food and Litter Box Basics for New Owners",
    excerpt: "Everything a first-time kitten owner needs to know about feeding and litter training.",
    publishedAt: "2026-02-10",
    body: [
      "Kittens need kitten-specific food (not adult cat food) until about 12 months old — it's higher in calories, protein and DHA to support brain and body development.",
      "Feed small, frequent meals — kittens under 6 months often do best with 3–4 meals a day, tapering to twice daily as they approach a year old.",
      "For litter training, use a low-sided box that's easy for a kitten to climb into, and place it somewhere quiet and accessible. Most kittens take to the litter box quickly with minimal training.",
      "Unscented, fine-grain clumping litter is generally the most kitten-friendly choice — strong fragrances can be off-putting and some kittens are sensitive to dust.",
    ],
  },
  {
    slug: "healthiest-dog-treats-for-training",
    title: "The Healthiest Dog Treats for Training and Everyday Rewards",
    excerpt: "Not all treats are created equal — here's how to pick training treats that support your dog's diet, not derail it.",
    publishedAt: "2026-02-18",
    body: [
      "Treats should make up no more than about 10% of your dog's daily calories — the rest should come from a complete and balanced main diet.",
      "For training, look for small, soft, low-calorie treats your dog can eat in one bite so you can reward quickly without interrupting a session.",
      "Single-ingredient treats (like freeze-dried meat) are a great option for dogs with food sensitivities, since there's no risk of a hidden ingredient triggering a reaction.",
      "Avoid treats with excessive fillers, artificial colors or added sugar — check the ingredient list the same way you would for your dog's regular food.",
    ],
  },
  {
    slug: "choosing-the-right-cat-litter",
    title: "How to Choose the Right Cat Litter",
    excerpt: "Clumping, non-clumping, crystal, or natural — a quick guide to matching litter type to your cat and your home.",
    publishedAt: "2026-02-25",
    body: [
      "Clumping clay litter is the most popular choice — it's easy to scoop daily and controls odor well, but it can be dusty.",
      "Crystal (silica gel) litter absorbs moisture and controls odor with less frequent full changes, which some owners prefer for convenience.",
      "Natural litters (pine, corn, walnut) are a good option for owners who want a lower-dust, more environmentally friendly option, though clumping performance varies by brand.",
      "Whatever type you choose, keep the box clean — most cats will avoid a dirty litter box, which can lead to accidents elsewhere in the home.",
    ],
  },
]

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null
}
