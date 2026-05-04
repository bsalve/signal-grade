exports.up = async (knex) => {
  await knex.schema.table('reports', (t) => {
    t.text('ai_summary').nullable().defaultTo(null)
    t.text('ai_recs_json').nullable().defaultTo(null)
  })
}

exports.down = async (knex) => {
  await knex.schema.table('reports', (t) => {
    t.dropColumn('ai_summary')
    t.dropColumn('ai_recs_json')
  })
}
