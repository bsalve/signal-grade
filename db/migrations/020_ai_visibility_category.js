exports.up = async (knex) => {
  await knex.schema.alterTable('ai_visibility_scans', (t) => {
    t.text('query_category').nullable() // 'awareness' | 'discovery' | 'recommendation'
    t.text('inferred_category').nullable() // e.g. 'SEO audit tool', 'restaurant chain'
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('ai_visibility_scans', (t) => {
    t.dropColumn('query_category')
    t.dropColumn('inferred_category')
  })
}
