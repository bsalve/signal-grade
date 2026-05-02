exports.up = (knex) => knex.schema.alterTable('reports', (t) => {
  t.text('cat_scores_json').nullable().defaultTo(null)
})

exports.down = (knex) => knex.schema.alterTable('reports', (t) => {
  t.dropColumn('cat_scores_json')
})
