# qa/check_skos.R
# Checks the built vocabulary. Structural checks run on the data (tidyverse only); if the rdflib
# package is installed, the Turtle and JSON-LD files are also parsed back and queried.
# Run from the repository root:   Rscript qa/check_skos.R

library(dplyr); library(purrr); library(readr); library(stringr); library(jsonlite)

raw      <- read_json("source/taxonomy_v5.json")
ids      <- map_chr(raw$concepts, "id")
parents  <- map_chr(raw$concepts, "parent_id", .default = NA_character_)
labels   <- map_chr(raw$concepts, "term")
defs     <- map_chr(raw$concepts, "definition", .default = "")
synonyms <- map(raw$concepts, \(c) as.character(unlist(c$synonyms)))
facets   <- map_chr(raw$concepts, "facet")
targets  <- unlist(map(raw$concepts, \(c) map_chr(c$relations, "target")))
retired  <- read_csv("source/v5_retired_ids.csv", show_col_types = FALSE)

# walk up the parent chain from every concept; a cycle would never reach a top concept
depth <- function(id, seen = character()) {
  if (id %in% seen) return(NA_integer_)
  p <- parents[match(id, ids)]
  if (is.na(p)) return(length(seen)) else depth(p, c(seen, id))
}

checks <- tribble(
  ~check,                                                   ~ok,
  "739 concepts",                                            length(ids) == 739,
  "ids are unique",                                          !anyDuplicated(ids),
  "every concept has a label",                               all(nzchar(labels)),
  "every concept has a definition",                          all(nzchar(defs)),
  "every parent exists",                                     all(parents[!is.na(parents)] %in% ids),
  "no parent is a retired id",                               !any(parents %in% retired$ID),
  "no cycles in the hierarchy",                              !any(is.na(map_int(ids, depth))),
  "every relation target exists",                            all(targets %in% ids),
  "every retired id's successor, where named, exists",       all(is.na(str_extract(retired$successor, "[A-Z]{2,4}_[0-9]+")) | str_extract(retired$successor, "[A-Z]{2,4}_[0-9]+") %in% ids),
  "no retired id is also a current id",                      !any(retired$ID %in% ids),
  "no synonym duplicates another concept's label",           !any(str_to_lower(unlist(synonyms)) %in% str_to_lower(labels)),
  "every concept belongs to one of 11 facets",               n_distinct(facets) == 11,
  "dist files exist",                                        all(file.exists(c("dist/climate-taxonomy.ttl", "dist/climate-taxonomy.jsonld", "dist/climate-taxonomy.csv", "dist/meliaf-relations.ttl"))),
  "one page per concept and per retired id",                 all(file.exists(sprintf("docs/terms/%s.html", c(ids, retired$ID))))
)

# JSON-LD: parse and count with jsonlite (always possible)
jl <- read_json("dist/climate-taxonomy.jsonld")
types <- map_chr(jl$`@graph`, \(n) n$type %||% n$`@type` %||% "")
checks <- add_row(checks, check = "JSON-LD parses and has 739 current + retired concepts",
                  ok = sum(types == "skos:Concept") == 739 + nrow(retired))

# Turtle: parse back with rdflib if available
if (requireNamespace("rdflib", quietly = TRUE)) {
  # plain SPARQL 1.0 patterns (the bundled engine has no COUNT or NOT EXISTS); counting is done in R
  SKOS <- "<http://www.w3.org/2004/02/skos/core#"
  g        <- rdflib::rdf_parse("dist/climate-taxonomy.ttl", format = "turtle")
  concepts <- rdflib::rdf_query(g, paste0("SELECT ?c WHERE { ?c a ", SKOS, "Concept> }"))
  broader  <- rdflib::rdf_query(g, paste0("SELECT ?s ?o WHERE { ?s ", SKOS, "broader> ?o }"))
  scheme   <- rdflib::rdf_query(g, paste0("SELECT ?t ?l ?v WHERE { ?s a ", SKOS, "ConceptScheme> ; <http://purl.org/dc/terms/title> ?t ; <http://purl.org/dc/terms/license> ?l ; <http://www.w3.org/2002/07/owl#versionInfo> ?v }"))
  checks <- checks |>
    add_row(check = "Turtle parses (rdflib)", ok = TRUE) |>
    add_row(check = "Turtle has 739 current + retired concepts", ok = n_distinct(concepts$c) == 739 + nrow(retired)) |>
    add_row(check = "every skos:broader points to a concept", ok = all(broader$o %in% concepts$c)) |>
    add_row(check = "scheme carries title, licence and version", ok = nrow(scheme) == 1)
} else {
  checks <- add_row(checks, check = "Turtle parse skipped: install.packages('rdflib') to enable", ok = NA)
}

report <- checks |> mutate(result = case_when(is.na(ok) ~ "SKIPPED", ok ~ "ok", TRUE ~ "FAIL"))
dir.create("qa", showWarnings = FALSE)
write_lines(c(format(Sys.time()), sprintf("%-8s %s", report$result, report$check)), "qa/report.txt")
cat(sprintf("%-8s %s\n", report$result, report$check), sep = "")
if (any(report$result == "FAIL")) stop("QA failed: see qa/report.txt") else cat("QA passed\n")
