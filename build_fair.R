# build_fair.R
# Publishes the climate adaptation taxonomy as a draft FAIR vocabulary.
# Reads source/, writes dist/ (Turtle, JSON-LD, CSV) and docs/ (landing page + one page per term).
# Run from this folder:   Rscript build_fair.R      then   Rscript qa/check_skos.R

library(dplyr); library(purrr); library(tidyr); library(stringr); library(readr); library(jsonlite); library(glue)

# 0. Settings: the only block that changes after the build-shop ------------------------------
BASE_IRI  <- "https://mlolita26.github.io/cgiar-climate-taxonomy/"   # provisional: where the pages are served today
FUTURE_IRI <- "https://w3id.org/cgiar/climate-taxonomy/"              # planned permanent namespace (to register after the build-shop)
VERSION   <- "6.0.0-draft"
STATUS    <- "draft"
LICENCE   <- "https://creativecommons.org/licenses/by/4.0/"          # proposed, pending confirmation
CUSTODIAN <- "CGIAR MELIAF Climate Adaptation Activator (Andreea Nowak, Lolita Muller), Alliance of Bioversity International and CIAT"
TITLE     <- "CGIAR Climate Adaptation and Mitigation Taxonomy"
DOI       <- ""                                                        # none for v6 yet (the Zenodo Sandbox test DOI 10.5072/zenodo.607948 belonged to the v5 draft release)
PUBLISHED <- "2026-11-09"                                              # first publication of this version
REPO      <- "https://github.com/Mlolita26/cgiar-climate-taxonomy"
TODAY     <- format(Sys.Date())
# review status of each term, from the column "Final verdict" of the v6 master (rules in Climate Master v6.docx)
REVIEW    <- c("awaiting external validation" = "Selected for validation by the climate community under the version 6 rules: every stand-alone term, and the context-dependent terms whose meaning the climate community sets (for example Rainfall) or that name a broad category of systems (for example Crop system).",
               "awaiting internal review"     = "Not part of the external validation. Reviewed internally, by mapping the term to CGIAR domains.",
               "review route to be decided"   = "The custodian has not yet decided how this term is reviewed.")
SCHEME    <- paste0(BASE_IRI, "scheme")
term_iri  <- function(id) paste0(BASE_IRI, "terms/", id)
future_iri <- function(id) paste0(FUTURE_IRI, id)

# 1. Read the taxonomy ------------------------------------------------------------------------
raw <- read_json("source/taxonomy_v6.json")
# identifiers the master must not use (a retired ID reused for a new concept) are published under a corrected ID
fix <- read_csv("source/id_corrections.csv", show_col_types = FALSE)
recode <- function(x) { i <- match(x, fix$id_in_master); ifelse(is.na(i), x, fix$published_id[i]) }
raw$concepts <- map(raw$concepts, function(c) {
  c$id <- recode(c$id); if (!is.null(c$parent_id)) c$parent_id <- recode(c$parent_id)
  c$relations <- map(c$relations, \(r) { if (!is.null(r$target)) r$target <- recode(r$target); r }); c })
concepts <- tibble(
  id            = map_chr(raw$concepts, "id"),
  term          = map_chr(raw$concepts, "term"),
  synonyms      = map(raw$concepts, \(c) as.character(unlist(c$synonyms))),
  facet         = map_chr(raw$concepts, "facet"),
  level         = map_int(raw$concepts, "level"),
  parent_id     = map_chr(raw$concepts, "parent_id", .default = NA_character_),
  definition    = map_chr(raw$concepts, "definition", .default = ""),
  source        = map_chr(raw$concepts, "definition_source", .default = ""),
  urls          = map(raw$concepts, \(c) str_split_1(c$reference_urls %||% "", "[;\\s]+") |> keep(nzchar)),
  stage         = map_chr(raw$concepts, "pathway_stage", .default = ""),
  area          = map_chr(raw$concepts, "climate_area", .default = ""),     # Adaptation | Adaptation + Mitigation | Mitigation
  role          = map_chr(raw$concepts, "tagging_role", .default = ""),     # Stand-alone | Context-dependent
  rule          = map_chr(raw$concepts, "context_rule", .default = ""),     # when a context-dependent term counts
  is_hazard     = map_lgl(raw$concepts, c("derived", "is_hazard")),
  example       = map_chr(raw$concepts, "cgiar_example", .default = ""),
  provenance    = map_chr(raw$concepts, c("provenance", "source"), .default = ""),
  review        = map_chr(raw$concepts, c("validation", "final_verdict"), .default = "")
) |>
  left_join(read_csv("source/provenance_map.csv", show_col_types = FALSE), by = "provenance") |>
  mutate(prov_class = coalesce(prov_class, "Domain expert"),
         review = case_when(review == "Yes" ~ names(REVIEW)[1], review == "No" ~ names(REVIEW)[2], TRUE ~ names(REVIEW)[3]))

relations <- map_dfr(raw$concepts, \(c) map_dfr(c$relations, \(r) tibble(id = c$id, type = r$type, target = r$target))) |>
  filter(target %in% concepts$id) |>
  mutate(prop = str_replace_all(type, "-(\\w)", \(m) toupper(str_sub(m, 2))))       # applies-to -> appliesTo

children <- concepts |> filter(!is.na(parent_id)) |> summarise(kids = list(id), .by = parent_id)
# an ID the master reuses for a different concept: the meaning it had when published is retired in v6
reused_ret <- function(retired_so_far) fix |> filter(!id_in_master %in% retired_so_far$ID) |>
  transmute(ID = id_in_master, Term = previous_term, Facet = previous_facet, successor = previous_successor,
            reason = paste0("identifier reused in master_v6 for a different concept (", term, ", published as ", published_id, ")"))
retired  <- bind_rows(read_csv("source/v5_retired_ids.csv", show_col_types = FALSE) |> mutate(retired_in = "5"),
                      read_csv("source/v6_retired_ids.csv", show_col_types = FALSE) |> mutate(retired_in = "6"))
retired  <- bind_rows(retired, reused_ret(retired) |> mutate(retired_in = "6")) |>
  mutate(reason    = paste0(reason, if_else(is.na(successor), "", paste0("; successor note: ", successor))),
         successor = str_extract(successor, "[A-Z]{2,4}_[0-9]+"),                     # "INT_306 Insurance" -> INT_306; "dropped" -> NA
         successor = if_else(successor %in% concepts$id, successor, NA_character_))
facets   <- read_csv("source/master_v5_controlled_values.csv", show_col_types = FALSE) |>
  filter(Column == "Facet") |> transmute(facet = Value, facet_def = Definition,
                                         slug = str_to_lower(facet) |> str_replace_all("[^a-z0-9]+", "-"))
cat(glue("Read {nrow(concepts)} concepts, {nrow(relations)} relations, {nrow(retired)} retired ids, {nrow(facets)} facets\n"))

# 2. Turtle -----------------------------------------------------------------------------------
esc <- function(x) x |> str_replace_all(fixed("\\"), "\\\\") |> str_replace_all(fixed('"'), '\\"') |> str_squish()
lit <- function(x) glue('"{esc(x)}"@en')
opt <- function(pred, values) if (length(values)) glue("{pred} {paste(values, collapse = ' , ')}") else character(0)

prefixes <- glue('
@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix ct:      <{BASE_IRI}terms/> .
@prefix meliaf:  <{BASE_IRI}relations/> .
')

scheme_ttl <- glue('
<{SCHEME}> a skos:ConceptScheme ;
    dcterms:title {lit(TITLE)} ;
    dcterms:description {lit("Controlled vocabulary for describing climate adaptation and mitigation in agricultural research results: concepts, definitions, synonyms, typed relations, and the conditions under which a term counts as adaptation or mitigation.")} ;
    dcterms:creator {lit(CUSTODIAN)} ;
    dcterms:publisher {lit("Alliance of Bioversity International and CIAT, for the CGIAR MELIAF project")} ;
    dcterms:created "{str_sub(raw$meta$built_at, 1, 10)}"^^xsd:date ;
    dcterms:modified "{TODAY}"^^xsd:date ;
    dcterms:license <{LICENCE}> ;
    dcterms:rights {lit("Licence proposed (CC BY 4.0), pending confirmation by the custodian.")} ;
    owl:versionInfo "{VERSION}" ;
    skos:note {lit(glue("Status: {STATUS}. Published for the MELIAF build-shop (Rabat, October 2026) so the container can be seen working. Identifiers use the GitHub Pages address for now; the planned permanent form is {FUTURE_IRI}<ID>, which will replace it without changing term ids."))} ;
    skos:historyNote {lit(glue("Version 6 built from master_v6.csv (revision of 16 October 2026) by build_taxonomy_v6.R; {nrow(concepts)} concepts. Version 6 replaced the per-axis adaptation and mitigation tags with three fields: climate area, tagging role and context rule. Version 5 (739 concepts, published 23 September 2026) is the previous release."))} ;
    rdfs:seeAlso <https://github.com/Mlolita26/cgiar-climate-taxonomy> .
')

concept_ttl <- function(id, term, synonyms, facet, parent_id, definition, source, urls, stage, area, role, rule, is_hazard, example, prov_class, provenance, review, ...) {
  rels <- relations |> filter(id == !!id)
  kids <- children$kids[match(id, children$parent_id)][[1]]
  body <- c(
    "a skos:Concept", glue("skos:inScheme <{SCHEME}>"), glue('skos:notation "{id}"'),
    glue("skos:prefLabel {lit(term)}"),
    opt("skos:altLabel", lit(synonyms)),
    glue("skos:definition {lit(definition)}"),
    if (nzchar(source)) glue('dcterms:source "{esc(source)}"'),
    opt("rdfs:seeAlso", glue("<{urls}>")),
    if (is.na(parent_id)) glue("skos:topConceptOf <{SCHEME}>") else glue("skos:broader ct:{parent_id}"),
    opt("skos:narrower", glue("ct:{kids}")),
    if (role == "Context-dependent") glue("skos:scopeNote {lit(paste('Counts only in context:', rule))}"),
    if (nzchar(example)) glue("skos:example {lit(example)}"),
    glue('meliaf:climateArea "{area}"'), glue('meliaf:taggingRole "{role}"'),
    if (nzchar(rule)) glue("meliaf:contextRule {lit(rule)}"),
    glue('meliaf:pathwayStage "{stage}"'),
    glue("meliaf:isHazard {tolower(is_hazard)}"),
    glue('meliaf:reviewStatus "{review}"'),
    opt("meliaf:provenance", glue('"{str_split_1(prov_class, "; ")}"')),
    glue("skos:historyNote {lit(paste('Provenance note in the master file:', provenance))}")
  )
  rel_lines <- imap_chr(split(rels$target, rels$prop), \(targets, p) glue("meliaf:{p} {paste0('ct:', targets, collapse = ' , ')}"))
  paste0("ct:", id, " ", paste(c(body, rel_lines), collapse = " ;\n    "), " .\n")
}
concepts_ttl <- pmap_chr(concepts, concept_ttl)

collections_ttl <- pmap_chr(facets, \(facet, facet_def, slug) glue('
ct:facet-{slug} a skos:Collection ;
    skos:inScheme <{SCHEME}> ;
    skos:prefLabel {lit(facet)} ;
    skos:definition {lit(facet_def)} ;
    skos:member {paste0("ct:", concepts$id[concepts$facet == facet], collapse = " , ")} .
'))

retired_ttl <- pmap_chr(retired, \(ID, Term, Facet, successor, reason, retired_in) glue('
ct:{ID} a skos:Concept ;
    skos:inScheme <{SCHEME}> ;
    skos:notation "{ID}" ;
    skos:prefLabel {lit(Term)} ;
    owl:deprecated true ;
    {if (!is.na(successor)) glue("dcterms:isReplacedBy ct:{successor} ;") else ""}
    skos:changeNote {lit(paste0("Retired in version ", retired_in, " (", reason, "). Facet was ", Facet, "."))} .
'))

relation_defs <- read_csv("source/relation_definitions.csv", show_col_types = FALSE) |> filter(prop %in% relations$prop)
ontology_ttl <- c(prefixes, glue('
<{BASE_IRI}relations/> a owl:Ontology ;
    dcterms:title {lit("MELIAF relation and rule properties for the climate taxonomy")} ;
    owl:versionInfo "{VERSION}" ;
    rdfs:comment {lit("Small extension of SKOS: the typed relations between concepts that the adaptation and mitigation decision rules use, and the per-concept rule attributes. Everything else in the vocabulary is plain SKOS.")} .
'),
  pmap_chr(relation_defs, \(prop, comment) glue('meliaf:{prop} a owl:ObjectProperty ; rdfs:label "{prop}"@en ; rdfs:comment {lit(comment)} .')),
  glue('meliaf:climateArea a owl:DatatypeProperty ; rdfs:label "climate area"@en ; rdfs:comment {lit("Which climate rule the concept belongs to: Adaptation, Mitigation, or Adaptation + Mitigation.")} .'),
  glue('meliaf:taggingRole a owl:DatatypeProperty ; rdfs:label "tagging role"@en ; rdfs:comment {lit("Stand-alone: the concept counts on its own. Context-dependent: it counts only in the context given by its context rule (see the concept scope note). Replaces the version 5 adaptation and mitigation tags (specific / conditional).")} .'),
  glue('meliaf:contextRule a owl:DatatypeProperty ; rdfs:label "context rule"@en ; rdfs:comment {lit("For a context-dependent concept: the context in which it counts.")} .'),
  glue('meliaf:pathwayStage a owl:DatatypeProperty ; rdfs:label "pathway stage"@en ; rdfs:comment {lit("Position in the results chain: Rationale, Intervention, Stakeholder, Output, Outcome, Impact, Cross-cutting, Uptake stage.")} .'),
  glue('meliaf:isHazard a owl:DatatypeProperty ; rdfs:label "is hazard"@en ; rdfs:comment {lit("True for the climate hazards that let conditional terms qualify.")} .'),
  glue('meliaf:reviewStatus a owl:DatatypeProperty ; rdfs:label "review status"@en ; rdfs:comment {lit(paste0("How the term is being reviewed. No term is validated yet. ", paste0(names(REVIEW), ": ", REVIEW, collapse = " ")))} .'),
  glue('meliaf:provenance a owl:DatatypeProperty ; rdfs:label "provenance"@en ; rdfs:comment {lit("Where the concept came from: Lexicon consensus, Domain expert, PRMS pilot, Restructure (v5), Revision (v6). A concept may carry several.")} .')
)

dir.create("dist", showWarnings = FALSE)
write_lines(c(prefixes, scheme_ttl, collections_ttl, concepts_ttl, retired_ttl), "dist/climate-taxonomy.ttl")
write_lines(ontology_ttl, "dist/meliaf-relations.ttl")
cat("Wrote dist/climate-taxonomy.ttl and dist/meliaf-relations.ttl\n")

# 3. JSON-LD -----------------------------------------------------------------------------------
iri_prop <- function(x) list("@id" = x, "@type" = "@id")
plain    <- function(x) list("@id" = x, "@language" = NULL)
context <- c(
  list("@language" = "en", skos = "http://www.w3.org/2004/02/skos/core#", dcterms = "http://purl.org/dc/terms/",
       owl = "http://www.w3.org/2002/07/owl#", rdfs = "http://www.w3.org/2000/01/rdf-schema#", xsd = "http://www.w3.org/2001/XMLSchema#",
       ct = paste0(BASE_IRI, "terms/"), meliaf = paste0(BASE_IRI, "relations/"),
       id = "@id", type = "@type",
       prefLabel = "skos:prefLabel", altLabel = "skos:altLabel", definition = "skos:definition", scopeNote = "skos:scopeNote",
       example = "skos:example", changeNote = "skos:changeNote", historyNote = "skos:historyNote", note = "skos:note",
       notation = plain("skos:notation"), source = plain("dcterms:source"), inScheme = iri_prop("skos:inScheme"),
       topConceptOf = iri_prop("skos:topConceptOf"), broader = iri_prop("skos:broader"), narrower = iri_prop("skos:narrower"),
       member = iri_prop("skos:member"), seeAlso = iri_prop("rdfs:seeAlso"), isReplacedBy = iri_prop("dcterms:isReplacedBy"),
       deprecated = list("@id" = "owl:deprecated", "@type" = "xsd:boolean"),
       climateArea = plain("meliaf:climateArea"), taggingRole = plain("meliaf:taggingRole"), contextRule = "meliaf:contextRule",
       pathwayStage = plain("meliaf:pathwayStage"), provenance = plain("meliaf:provenance"), reviewStatus = plain("meliaf:reviewStatus"),
       isHazard = list("@id" = "meliaf:isHazard", "@type" = "xsd:boolean")),
  set_names(map(relation_defs$prop, \(p) iri_prop(paste0("meliaf:", p))), relation_defs$prop)
)
concept_json <- function(id, term, synonyms, facet, parent_id, definition, source, urls, stage, area, role, rule, is_hazard, example, prov_class, provenance, review, ...) {
  rels <- relations |> filter(id == !!id)
  kids <- children$kids[match(id, children$parent_id)][[1]]
  compact(c(list(
    id = paste0("ct:", id), type = "skos:Concept", inScheme = SCHEME, notation = id, prefLabel = term,
    altLabel = if (length(synonyms)) I(synonyms), definition = definition, source = if (nzchar(source)) source,
    seeAlso = if (length(urls)) I(urls),
    topConceptOf = if (is.na(parent_id)) SCHEME, broader = if (!is.na(parent_id)) paste0("ct:", parent_id),
    narrower = if (length(kids)) I(paste0("ct:", kids)),
    scopeNote = if (role == "Context-dependent") paste("Counts only in context:", rule),
    example = if (nzchar(example)) example,
    climateArea = area, taggingRole = role, contextRule = if (nzchar(rule)) rule, pathwayStage = stage, isHazard = is_hazard,
    reviewStatus = review, provenance = I(str_split_1(prov_class, "; ")), historyNote = paste("Provenance note in the master file:", provenance)),
    if (nrow(rels)) map(split(paste0("ct:", rels$target), rels$prop), I) else list()))
}
graph <- c(
  list(compact(list(id = SCHEME, type = "skos:ConceptScheme", "dcterms:title" = TITLE, "dcterms:creator" = CUSTODIAN,
                    "dcterms:license" = list("@id" = LICENCE), "owl:versionInfo" = VERSION, "dcterms:modified" = TODAY,
                    note = paste("Status:", STATUS)))),
  pmap(facets, \(facet, facet_def, slug) list(id = paste0("ct:facet-", slug), type = "skos:Collection", prefLabel = facet,
                                              definition = facet_def, member = I(paste0("ct:", concepts$id[concepts$facet == facet])))),
  pmap(concepts, concept_json),
  pmap(retired, \(ID, Term, Facet, successor, reason, retired_in) compact(list(
    id = paste0("ct:", ID), type = "skos:Concept", inScheme = SCHEME, notation = ID, prefLabel = Term, deprecated = TRUE,
    isReplacedBy = if (!is.na(successor)) paste0("ct:", successor), changeNote = paste0("Retired in version ", retired_in, " (", reason, ")."))))
)
write_json(list("@context" = context, "@graph" = graph), "dist/climate-taxonomy.jsonld", auto_unbox = TRUE, pretty = TRUE, null = "null")
cat("Wrote dist/climate-taxonomy.jsonld\n")

# 4. Flat CSV and CHANGELOG ----------------------------------------------------------------------
concepts |>
  transmute(id, iri = term_iri(id), term, synonyms = map_chr(synonyms, paste, collapse = "; "), facet, level, parent_id,
            definition, definition_source = source, pathway_stage = stage,
            climate_area = area, tagging_role = role, context_rule = rule,
            is_hazard, provenance = prov_class, review_status = review, status = "current", version = VERSION) |>
  bind_rows(retired |> transmute(id = ID, iri = term_iri(ID), term = Term, facet = Facet, status = "deprecated",
                                 parent_id = successor, definition = paste0("Retired in version ", retired_in, ": ", reason), version = VERSION)) |>
  write_csv("dist/climate-taxonomy.csv", na = "")

tc <- read_csv("source/v5_to_v6_TERM_CHANGES.csv", show_col_types = FALSE) |> mutate(ID = recode(ID), change = if_else(ID %in% fix$published_id, "ADDED", change)) |>
  distinct(change, ID, .keep_all = TRUE)                                     # a corrected ID is a new concept: one ADDED line
sc <- read_csv("source/v5_to_v6_SYNONYM_CHANGES.csv", show_col_types = FALSE)
listed <- function(kind) tc |> filter(change %in% kind) |> distinct(ID, term, facet) |> transmute(line = glue("- `{ID}` {term} ({facet})")) |> pull(line)
old_log <- read_lines("CHANGELOG.md")
old_log <- old_log[seq(match(TRUE, str_starts(old_log, "## 5.0.0-draft")), length(old_log))]   # keep the version 5 entry below
write_lines(c(
  glue("# Changelog\n\n## {VERSION} (published {PUBLISHED}, updated {TODAY})\n"),
  glue("Content is version 6 of the taxonomy (master_v6.csv, revision of 16 October 2026). Draft status.\n"),
  glue("Update of 2026-11-20: every concept now carries a review status (`meliaf:reviewStatus`), taken from the column Final verdict of the version 6 master: {paste0(names(REVIEW), ' (', map_int(names(REVIEW), \\(r) sum(concepts$review == r)), ')', collapse = ', ')}. No term is validated yet. The web site was redesigned, with a search box on every page, a term browser and pages for downloads, releases, contributing and the tools that use the taxonomy. No concept, identifier or definition changed.\n"),
  "Version 6 replaced the per-axis columns (climate scope, adaptation tag and condition, mitigation tag and condition) with three: climate area, tagging role (stand-alone or context-dependent) and context rule. The vocabulary publishes these as `meliaf:climateArea`, `meliaf:taggingRole` and `meliaf:contextRule`.\n",
  "## Version 6 compared with version 5\n",
  glue("{nrow(concepts)} concepts (version 5 had 739). Changes recorded at term level (a concept can appear under several):\n"),
  tc |> count(change) |> transmute(line = glue("- {change}: {n}")) |> pull(line),
  glue("\nSynonyms: {sum(sc$change == 'ADDED')} added, {sum(sc$change == 'REMOVED')} removed, {sum(sc$change == 'MOVED')} moved to another concept.\n"),
  "### Added concepts\n", listed(c("ADDED", "ADDED (ID REUSED)")),
  "\n### Concepts moved to a new identifier (old identifier kept, marked deprecated, pointing to the new one)\n", listed("MOVED (NEW ID)"),
  "\n### Retired concepts\n", listed("RETIRED"),
  "\n### Renamed concepts\n", listed("RENAMED"),
  "\n### Identifier correction\n",
  pmap_chr(select(fix, id_in_master, published_id, term, reason), \(id_in_master, published_id, term, reason) glue("- {term}: published as `{published_id}`, not `{id_in_master}` ({reason}).")),
  "\nFull detail: `source/v5_to_v6_TERM_CHANGES.csv` and `source/v5_to_v6_SYNONYM_CHANGES.csv`.\n",
  old_log
), "CHANGELOG.md")
cat("Wrote dist/climate-taxonomy.csv and CHANGELOG.md\n")

# 5. Site: the page shell, the data for search and browsing, one page per term, and the main pages -------------------
# The look follows the established ontology sites (Disease Ontology in particular): a menu, a search box on every page,
# a browser with the tree on the left and the term on the right. docs/style.css and docs/site.js are written by hand.
h <- function(x) x |> str_replace_all("&", "&amp;") |> str_replace_all("<", "&lt;") |> str_replace_all(">", "&gt;")
by_label <- function(ids) ids[order(concepts$term[match(ids, concepts$id)])]
link <- function(ids) if (length(ids)) paste0(glue('<a href="{ids}.html">{h(concepts$term[match(ids, concepts$id)])}</a>'), collapse = ", ") else "none"
mrow <- function(k, v) glue("<tr><th>{k}</th><td>{v}</td></tr>")
change_url <- function(id, term) paste0(REPO, "/issues/new?template=change-term.yml&title=", URLencode(paste0("[Change] ", id, " ", term), reserved = TRUE), "&term_id=", id)
facet_slug <- function(f) coalesce(facets$slug[match(f, facets$facet)], "")
facet_prefix <- map_chr(facets$facet, \(f) names(sort(table(str_extract(concepts$id[concepts$facet == f], "^[A-Z]+")), decreasing = TRUE))[1])

PAGE <- read_file("templates/page.html")                        # the shell every page shares; <<...>> are filled by glue
NAV  <- c(browse = "Browse", downloads = "Downloads", releases = "Releases", contribute = "Contribute", about = "About", tools = "Tools")
nav_html  <- function(pageid, depth) paste0('<a href="', depth, names(NAV), '.html"', if_else(names(NAV) == pageid, ' class="on"', ""), ">", NAV, "</a>", collapse = "")
band_html <- function(title, sub = "", crumbs = "") glue('<section class="band"><div class="wrap">{crumbs}<h1>{title}</h1>{if (nzchar(sub)) paste0("<p>", sub, "</p>") else ""}</div></section>')
page <- function(title, body, depth = "", pageid = "", band = band_html(h(title))) glue(PAGE, .open = "<<", .close = ">>")
template <- function(file) glue(read_file(file.path("templates", file)), .open = "<<", .close = ">>", .envir = globalenv())

# 5a. Data for the search box and the browser (read by docs/site.js)
dir.create("docs/data", showWarnings = FALSE, recursive = TRUE)
site_data <- list(
  version = VERSION, base = BASE_IRI, future = FUTURE_IRI, repo = REPO, review = as.list(REVIEW), review_ext = names(REVIEW)[1],
  facets = pmap(list(facets$facet, facets$facet_def, facets$slug, facet_prefix), \(f, d, s, p) list(
    slug = s, name = f, def = d, prefix = p, n = sum(concepts$facet == f), top = I(by_label(concepts$id[concepts$facet == f & is.na(concepts$parent_id)])))),
  concepts = pmap(concepts, function(id, term, synonyms, facet, parent_id, definition, source, urls, stage, area, role, rule, example, prov_class, review, ...) {
    rels <- relations |> filter(id == !!id)
    compact(list(id = id, t = term, s = if (length(synonyms)) I(synonyms), f = facet, fs = facet_slug(facet), p = if (!is.na(parent_id)) parent_id,
                 d = definition, src = if (nzchar(source)) source, u = if (length(urls)) I(urls), st = stage, a = area, r = role,
                 cr = if (nzchar(rule)) rule, rv = review, ex = if (nzchar(example)) example, pv = prov_class,
                 rel = if (nrow(rels)) map2(rels$type, rels$target, \(a, b) c(a, b))))
  }),
  retired = pmap(retired, \(ID, Term, Facet, successor, reason, retired_in) compact(list(
    id = ID, t = Term, f = Facet, by = if (!is.na(successor)) successor, why = reason, v = retired_in)))
)
write_json(site_data, "docs/data/terms.json", auto_unbox = TRUE, null = "null")

# 5b. One page per term: the band shows the path from the facet down, the body a metadata table as on the browser
term_band <- function(id, title, facet, tag = "") {
  anc <- character(); p <- concepts$parent_id[concepts$id == id]
  while (length(p) && !is.na(p)) { anc <- c(p, anc); p <- concepts$parent_id[concepts$id == p] }
  crumbs <- paste(c(glue('<a href="../browse.html#facet-{facet_slug(facet)}">{h(facet)}</a>'),
                    if (length(anc)) glue('<a href="{anc}.html">{h(concepts$term[match(anc, concepts$id)])}</a>')), collapse = " › ")
  band_html(paste0(h(title), tag), crumbs = glue('<div class="crumbs">{crumbs}</div>'))
}
address_row <- function(id) mrow("Address", glue('<a href="{term_iri(id)}">{term_iri(id)}</a><button class="copy" data-copy="{term_iri(id)}">Copy</button><div class="src">Planned permanent address: {future_iri(id)}</div>'))
dir.create("docs/terms", showWarnings = FALSE, recursive = TRUE)
pwalk(concepts, function(id, term, synonyms, facet, parent_id, definition, source, urls, stage, area, role, rule, is_hazard, example, prov_class, provenance, review, ...) {
  rels <- relations |> filter(id == !!id)
  kids <- by_label(children$kids[match(id, children$parent_id)][[1]])
  refs <- if (length(urls)) paste0(" · ", paste(glue('<a href="{urls}">reference</a>'), collapse = ", ")) else ""
  rows <- c(
    mrow("ID", glue("<code>{id}</code>")), address_row(id), mrow("Name", h(term)),
    mrow("Definition", glue('{h(definition)}<div class="src">Source: {h(source)}{refs}</div>')),
    mrow("Synonyms", if (length(synonyms)) h(paste(synonyms, collapse = ", ")) else "none"),
    mrow("Facet", glue('<a href="../browse.html#facet-{facet_slug(facet)}">{h(facet)}</a>')), mrow("Pathway stage", h(stage)),
    mrow("Broader", if (is.na(parent_id)) "Top concept of the facet" else link(parent_id)),
    mrow("Narrower", link(kids)),
    if (nrow(rels)) mrow("Relations", paste0("<span class=k>", rels$type, "</span>", map_chr(rels$target, link), collapse = "<br>")),
    mrow("Climate area", h(area)),
    mrow("Tagging role", if (role == "Stand-alone") "Stand-alone: counts on its own." else paste0("Context-dependent: counts only when ", h(rule))),
    mrow("Review status", glue('<span class="status{if (review == names(REVIEW)[1]) " ext" else ""}">{review}</span> <span class="src">{h(REVIEW[[review]])}</span>')),
    if (nzchar(example)) mrow("Example of use", h(example)),
    mrow("Provenance", h(prov_class))
  )
  body <- glue('<div class="actions"><a class="btn primary" href="../browse.html#{id}">Show in the tree</a><a class="btn" href="{change_url(id, term)}">Propose a change</a><a class="btn" href="../downloads.html">Download the vocabulary</a></div>
<table class="meta">{paste(rows, collapse = "\n")}</table>
<script type="application/ld+json">{toJSON(list("@context" = context, "@graph" = list(concept_json(id, term, synonyms, facet, parent_id, definition, source, urls, stage, area, role, rule, is_hazard, example, prov_class, provenance, review))), auto_unbox = TRUE, null = "null")}</script>')
  write_file(page(term, body, "../", "browse", term_band(id, term, facet)), glue("docs/terms/{id}.html"))
})
pwalk(retired, function(ID, Term, Facet, successor, reason, retired_in) {
  rows <- c(mrow("ID", glue("<code>{ID}</code>")), address_row(ID), mrow("Name", h(Term)),
            mrow("Status", glue('<span class="status retired">retired</span> in version {retired_in}. The identifier is kept so that older reporting stays readable, and will never be reused.')),
            mrow("Replaced by", if (is.na(successor)) "No successor (concept dropped)" else link(successor)),
            mrow("Reason", h(reason)), mrow("Facet", h(Facet)))
  body <- glue('<table class="meta">{paste(rows, collapse = "\n")}</table>')
  write_file(page(paste(Term, "(retired)"), body, "../", "browse", term_band(ID, Term, Facet, ' <span class="tag">retired</span>')), glue("docs/terms/{ID}.html"))
})

# 5c. Values the main pages show
n_syn <- sum(lengths(concepts$synonyms))
count_rows <- function(values, labels = values) paste0("<tr><td>", h(labels), '</td><td class="num">', map_int(values, \(v) sum(concepts$review == v | concepts$area == v)), "</td></tr>", collapse = "")
facet_rows <- paste0('<tr><td><a href="browse.html#facet-', facets$slug, '">', h(facets$facet), '</a></td><td class="num">', map_int(facets$facet, \(f) sum(concepts$facet == f)), "</td></tr>", collapse = "")
facet_def_rows <- paste0('<tr><td><a href="#facet-', facets$slug, '">', h(facets$facet), "</a></td><td>", h(facets$facet_def), '</td><td class="num">', map_int(facets$facet, \(f) sum(concepts$facet == f)), "</td></tr>", collapse = "")
area_rows   <- count_rows(sort(unique(concepts$area)))
review_rows <- count_rows(names(REVIEW))
review_defs <- paste0('<tr><td><span class="status', if_else(names(REVIEW) == names(REVIEW)[1], " ext", ""), '">', names(REVIEW), "</span></td><td>", h(REVIEW), '</td><td class="num">', map_int(names(REVIEW), \(r) sum(concepts$review == r)), "</td></tr>", collapse = "")
examples <- paste0(glue('<a href="terms/{ids}.html">{h(concepts$term[match(ids, concepts$id)])}</a>', ids = concepts$id[match(c("Drought", "Seed system", "Index insurance", "Agroforestry", "Smallholder farmer"), concepts$term)] |> discard(is.na)), collapse = " · ")
fair_rows  <- read_csv("source/fair_checklist.csv", show_col_types = FALSE)   # Cox et al. 2021, Table 1, with our status
fair_table <- paste0("<tr><td class=p>", fair_rows$principle, "</td><td>", h(fair_rows$test), "</td><td class=",
                     if_else(str_starts(fair_rows$status, "Yes"), "ok", "pend"), ">", h(fair_rows$status), "</td></tr>", collapse = "")
cite_doi   <- if (!nzchar(DOI)) "DOI to follow." else if (str_starts(DOI, "10.5072")) glue('Test DOI (Zenodo Sandbox, not resolvable outside it): <a href="https://sandbox.zenodo.org/records/{str_extract(DOI, "[0-9]+$")}">{DOI}</a>. A permanent DOI comes with the first non-draft release.') else glue('<a href="https://doi.org/{DOI}">doi:{DOI}</a>')
citation   <- glue("Nowak, A. and Muller, L. ({str_sub(PUBLISHED, 1, 4)}). {h(TITLE)}, version {VERSION}. CGIAR MELIAF. {cite_doi}")

# the tree of the browser: each facet, then its top concepts, children indented under their parent
tree <- function(ids) {
  if (!length(ids)) return("")
  items <- map_chr(by_label(ids), function(i) {
    kids <- children$kids[match(i, children$parent_id)][[1]]
    a <- glue('<a href="#{i}" data-id="{i}">{h(concepts$term[concepts$id == i])}</a>')
    if (length(kids)) glue('<li><details><summary>{a}<span class="n">{length(kids)}</span></summary>{tree(kids)}</details></li>') else glue("<li>{a}</li>")
  })
  paste0("<ul>", paste(items, collapse = ""), "</ul>")
}
browse_tree <- paste(pmap_chr(list(facets$facet, facets$slug), \(f, s) {
  glue('<details class="facet" id="facet-{s}"><summary>{h(f)}<span class="n">{sum(concepts$facet == f)}</span></summary>{tree(concepts$id[concepts$facet == f & is.na(concepts$parent_id)])}</details>')
}), collapse = "")

# downloads: the files and the columns of the CSV
downloads <- tribble(~file, ~format, ~what,
  "climate-taxonomy.ttl",    "SKOS, Turtle",   "The whole vocabulary: concepts, labels, synonyms, definitions and sources, hierarchy, facets, relations, retired identifiers.",
  "climate-taxonomy.jsonld", "SKOS, JSON-LD",  "The same content as the Turtle file, for programs that read JSON.",
  "climate-taxonomy.csv",    "CSV",            "One row per concept and per retired identifier, for spreadsheets. Columns below.",
  "meliaf-relations.ttl",    "OWL, Turtle",    "Definitions of the properties the vocabulary adds to SKOS: the typed relations and the rule attributes.")
download_rows <- paste0('<tr><td><a href="dist/', downloads$file, '">', downloads$file, "</a></td><td>", downloads$format, "</td><td>", downloads$what,
                        '</td><td class="num">', round(file.size(file.path("dist", downloads$file)) / 1024), " KB</td></tr>", collapse = "")
csv_cols <- tribble(~col, ~meaning,
  "id", "Identifier, for example CRK_102. Never reused.", "iri", "Web address of the term.", "term", "Preferred label.",
  "synonyms", "Other words for the same concept, separated by semicolons.", "facet", "One of the eleven facets.", "level", "Depth in the hierarchy (1 = top concept).",
  "parent_id", "Broader concept. For a retired identifier: its successor, if any.", "definition", "Definition. For a retired identifier: when and why it was retired.",
  "definition_source", "Authority the definition comes from.", "pathway_stage", "Position in the results chain.",
  "climate_area", "Adaptation, Mitigation, or Adaptation + Mitigation.", "tagging_role", "Stand-alone (counts on its own) or Context-dependent.",
  "context_rule", "For a context-dependent term: when it counts.", "is_hazard", "TRUE for climate hazards.", "provenance", "Where the concept came from.",
  "review_status", "How the term is being reviewed (see About).", "status", "current or deprecated.", "version", "Version of the vocabulary.")
csv_rows <- paste0("<tr><td><code>", csv_cols$col, "</code></td><td>", h(csv_cols$meaning), "</td></tr>", collapse = "")

# contribute: one card per issue form, and the decisions taken so far
forms <- tribble(~file, ~name, ~what,
  "term-request.yml", "New term",       "A concept the taxonomy does not have yet.",
  "add-synonym.yml",  "Synonym",        "Another word people use for an existing term.",
  "change-term.yml",  "Change a term",  "A definition, label, source or position to correct.",
  "retire-term.yml",  "Retire a term",  "A term that should leave the vocabulary, or merge into another.",
  "report-error.yml", "Report an error", "A mistake in the data, a page or a download.")
form_cards <- paste0('<a class="card" href="', REPO, "/issues/new?template=", forms$file, '"><h2>', forms$name, "</h2><p>", forms$what, "</p></a>", collapse = "")
decisions  <- read_csv("governance/decisions.csv", show_col_types = FALSE)
decision_rows <- paste0("<tr><td>", decisions$date, '</td><td><a href="', decisions$issue, '">', h(decisions$proposal), "</a></td><td>", h(decisions$decision), "</td><td>", h(decisions$reason), "</td></tr>", collapse = "")

# releases: the change log as a page (headings, lists, paragraphs, code)
md_html <- function(lines) {
  inline <- function(x) h(x) |> str_replace_all("`([^`]+)`", "<code>\\1</code>") |> str_replace_all("\\*\\*([^*]+)\\*\\*", "<b>\\1</b>") |>
    str_replace_all("\\[([^]]+)\\]\\(([^)]+)\\)", '<a href="\\2">\\1</a>')
  out <- character(); inlist <- FALSE
  for (l in lines) {
    if (str_starts(l, "- ")) { if (!inlist) out <- c(out, "<ul>"); inlist <- TRUE; out <- c(out, paste0("<li>", inline(str_sub(l, 3)), "</li>")); next }
    if (inlist) { out <- c(out, "</ul>"); inlist <- FALSE }
    if (str_starts(l, "### ")) out <- c(out, paste0("<h3>", inline(str_sub(l, 5)), "</h3>"))
    else if (str_starts(l, "## ")) out <- c(out, paste0("<h2>", inline(str_sub(l, 4)), "</h2>"))
    else if (nzchar(str_trim(l)) && !str_starts(l, "# ")) out <- c(out, paste0("<p>", inline(l), "</p>"))
  }
  paste(c(out, if (inlist) "</ul>"), collapse = "\n")
}
changelog_html <- md_html(read_lines("CHANGELOG.md"))

# 5d. Write the main pages
hero <- glue('<section class="band hero"><div class="wrap"><h1>{h(TITLE)}</h1><p>A controlled vocabulary for describing climate adaptation and mitigation in agricultural research: {nrow(concepts)} concepts with definitions and their sources, {n_syn} synonyms, {nrow(relations)} typed relations, and the conditions under which a term counts as adaptation or mitigation. Version {VERSION}.</p></div></section>')
write_file(page("Home", template("index.html"), "", "home", hero), "docs/index.html")
write_file(page("Browse", template("browse.html"), "", "browse", band_html("Browse the taxonomy", glue("{nrow(facets)} facets, {nrow(concepts)} terms. Choose a term in the tree, or search above."))), "docs/browse.html")
write_file(page("Downloads", template("downloads.html"), "", "downloads", band_html("Downloads", "The vocabulary in SKOS (Turtle and JSON-LD) and as a CSV, free to reuse.")), "docs/downloads.html")
write_file(page("Releases", template("releases.html"), "", "releases", band_html("Releases", "What changed in each version.")), "docs/releases.html")
write_file(page("Contribute", template("contribute.html"), "", "contribute", band_html("Contribute", "Propose to add, change or retire a term.")), "docs/contribute.html")
write_file(page("About", template("about.html"), "", "about", band_html("About the taxonomy", "What it is, who maintains it, how to cite it, and how FAIR it is.")), "docs/about.html")
write_file(page("Tools", template("tools.html"), "", "tools", band_html("Tools and uses", "Tools built on the taxonomy, and where it is used.")), "docs/tools.html")
write_file(page("Method", template("method.html"), "", "about", band_html("Method", "How the taxonomy became a FAIR vocabulary.")), "docs/method.html")
invisible(file.create("docs/.nojekyll"))
dir.create("docs/dist", showWarnings = FALSE)
file.copy(list.files("dist", full.names = TRUE), "docs/dist", overwrite = TRUE) |> invisible()
cat(glue("Wrote {nrow(concepts) + nrow(retired)} term pages, 8 main pages and docs/data/terms.json\n"))
