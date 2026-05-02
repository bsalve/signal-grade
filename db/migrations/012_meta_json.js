exports.up = (knex) => knex.schema.alterTable('reports', (t) => {
  t.text('meta_json').nullable().defaultTo(null)
})

exports.down = (knex) => knex.schema.alterTable('reports', (t) => {
  t.dropColumn('meta_json')
})
