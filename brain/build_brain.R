# build_brain.R
# Builds docs/index.html: a page that highlights climate taxonomy terms as you type and
# derives the adaptation and mitigation verdicts with the same element-count rule as the
# PRMS tagging pipeline. Everything about the taxonomy and the rule parameters lives here
# in R; the page's JavaScript only does the matching and counting in the browser.
#
# Run from the repository root:   Rscript build_brain.R

library(dplyr)
library(purrr)
library(tidyr)
library(stringr)
library(jsonlite)

# 1. Read the taxonomy -----------------------------------------------------------

raw <- read_json("data/taxonomy_v5.json")

concepts <- tibble(
  id                   = map_chr(raw$concepts, "id"),
  term                 = map_chr(raw$concepts, "term"),
  synonyms             = map(raw$concepts, \(c) I(as.character(unlist(c$synonyms)))),  # I() keeps a single synonym as a list in JSON
  facet                = map_chr(raw$concepts, "facet"),
  group                = map_chr(raw$concepts, c("derived", "group")),          # anchor / intervention / system / ... (the rule's role groups)
  stage                = map_chr(raw$concepts, "pathway_stage",     .default = ""),
  definition           = map_chr(raw$concepts, "definition",        .default = ""),
  definition_source    = map_chr(raw$concepts, "definition_source", .default = ""),
  parent_id            = map_chr(raw$concepts, "parent_id",         .default = NA_character_),
  adaptation           = map_chr(raw$concepts, c("adaptation", "tag")),          # Adaptation-specific / Adaptation-conditional / n/a
  adaptation_condition = map_chr(raw$concepts, c("adaptation", "condition")),
  mitigation           = map_chr(raw$concepts, c("mitigation", "tag")),
  mitigation_condition = map_chr(raw$concepts, c("mitigation", "condition")),
  is_hazard            = map_lgl(raw$concepts, c("derived", "is_hazard")),
  provenance           = map_chr(raw$concepts, c("provenance", "source"), .default = ""),
  relations            = map(raw$concepts, \(c) map(c$relations, \(r) list(type = r$type, target = r$target)))
)

# 2. One row per word people might actually write: the preferred term and every synonym

labels <- bind_rows(
  concepts |> transmute(id, label = term, kind = "term"),
  concepts |> select(id, synonyms) |> unnest(synonyms) |> transmute(id, label = synonyms, kind = "synonym")
) |>
  filter(label != "") |>
  distinct()

# 3. The decision rule, as parameters (from PRMS_Tagging_v5.Rmd and the decision-rule files)

rules <- list(
  # stored relations that let a conditional term count, per axis
  adaptation_relations = c("addresses", "produces", "applies-to", "measured-by", "part-of", "composed-of", "reduces", "builds"),
  mitigation_relations = c("reduces-emissions", "sequesters", "produces", "applies-to", "measured-by", "part-of", "composed-of", "reduces", "builds"),
  # 'emits' names an emitting system, it does not make a term count as mitigation
  # relations whose anchor must be a real climate hazard, not the umbrella 'Climate change' driver
  hazard_only_relations = c("addresses", "exposed-to", "measured-by"),
  # from-text relations the pipeline's model asserts; the page stands in for them with a same-sentence proxy
  from_text_relations = c("attributed-to", "exposed-to", "benefits-from", "engaged-in"),
  # role group -> pathway element (cross-cutting fills rationale only when specific; adoption fills nothing)
  element_of = list(anchor = "rationale", intervention = "intervention",
                    system = "system/stakeholder", stakeholder = "system/stakeholder",
                    output = "result", outcome = "result", impact = "result"),
  # distinct elements -> verdict and weight
  verdicts = list(list(min = 4, verdict = "Full",    weight = 1.00),
                  list(min = 3, verdict = "Partial", weight = 0.75),
                  list(min = 2, verdict = "Partial", weight = 0.50),
                  list(min = 1, verdict = "Minimal", weight = 0.25),
                  list(min = 0, verdict = "None",    weight = 0.00)),
  # ultra-generic surface forms that must never match on their own
  stop_words = c("the","and","for","with","use","used","using","other","new","data","area",
                 "level","type","and/or","per","via","from","into","onto","that","this","are",
                 "set","kind","form","based","non","pre","post","sub")
)

# 4. Homonym guards: words that stay in the vocabulary but must not fire in these contexts

guards <- tribble(
  ~id,       ~pattern,
  "INT_160", "\\bCOP ?\\d+\\b|Conference of the Parties",
  "INT_321", "\\b(yield|research|capacity|knowledge|data|evidence|gender)\\s+gaps?\\b|\\bgap analysis\\b",
  "OTC_136", "\\bregions?\\s+of\\s+interest\\b|\\bROIs?\\b(?=[^.]*\\b(image|imagery|raster|pixel|remote sensing|satellite)\\b)",
  "INT_274", "\\bagro[- ]?ecological\\s+(zone|zoning|zonation|region)",
  "INT_329", "\\b(repair|machine|machinery|welding|carpentry|processing|fabrication|maintenance|artisan|tailoring|blacksmith)\\s+workshops?\\b|\\bworkshops?\\s+(floor|equipment|tools|premises|building|space)\\b"
)

# 5. Sample texts shown in the page: two real 2025 PRMS results and the rule's own worked examples

samples <- tribble(
  ~name, ~text,
  "PRMS result: digital advisory, Ghana",
  "The innovation is a digital advisory tool designed to provide cropping calendar advisories to farmers in Northern Ghana. This platform delivers a comprehensive suite of agronomic advisories, including optimal planting times, thinning schedules, fertilizer application guidelines, weeding, pest management strategies, and harvest and postharvest operations. Aimed at enhancing resource use efficiency and mitigating drought risks, the tool empowers farmers to become more resilient against climate variability. It is intended for use by farmers seeking to optimize their agricultural practices and improve crop yield and sustainability in the challenging climatic conditions of Northern Ghana.",
  "PRMS result: genebank collecting mission",
  "Responding to growing demand from genebank users, CIAT genebank conducted a third collecting mission in New Mexico and Texas, focusing on heat- and drought-tolerant Phaseolus species (e.g., P. acutifolius, P. filiformis). The mission was led by USDA in collaboration with New Mexico State University. 23 new populations were collected, as the previous rain season was sustained and significant.",
  "Worked example: full pathway",
  "Drip irrigation was deployed against recurrent drought in the maize cropping systems of southern Zambia. Smallholder farmers adopted the system on 1,200 hectares, and maize yield was maintained under drought stress in the 2024 season.",
  "Worked example: terms without a hazard (scores None)",
  "The project distributed fertilizer to 2,000 smallholder farmers in Malawi through agro-dealers to raise maize yields. Yields increased by 20 percent on participating farms and household income improved."
)

# 6. A few numbers for the page header and footer

meta <- list(
  schema      = raw$meta$schema,
  built_at    = raw$meta$built_at,
  builder     = raw$meta$builder,
  n_concepts  = nrow(concepts),
  n_synonyms  = sum(labels$kind == "synonym"),
  n_relations = sum(lengths(concepts$relations)),
  n_specific  = sum(concepts$adaptation == "Adaptation-specific"),
  n_conditional = sum(concepts$adaptation == "Adaptation-conditional"),
  page_built  = format(Sys.Date())
)

# 7. Put the data into the page template and write docs/index.html -----------------

as_json <- function(x) toJSON(x, auto_unbox = TRUE, na = "null", null = "null")

inject <- function(html, placeholder, value) {
  parts <- str_split_fixed(html, fixed(placeholder), 2)
  paste0(parts[1], value, parts[2])
}

page <- readr::read_file("template/brain.html") |>
  inject("__META__",     as_json(meta)) |>
  inject("__CONCEPTS__", as_json(concepts)) |>
  inject("__LABELS__",   as_json(labels)) |>
  inject("__RULES__",    as_json(rules)) |>
  inject("__GUARDS__",   as_json(guards)) |>
  inject("__SAMPLES__",  as_json(samples))

dir.create("docs", showWarnings = FALSE)
readr::write_file(page, "docs/index.html")
invisible(file.create("docs/.nojekyll"))   # tells GitHub Pages to serve the folder as-is

cat(sprintf("Wrote docs/index.html: %d concepts (%d specific, %d conditional), %d synonyms, %d relations (%.0f KB)\n",
            meta$n_concepts, meta$n_specific, meta$n_conditional, meta$n_synonyms, meta$n_relations,
            file.size("docs/index.html") / 1024))
