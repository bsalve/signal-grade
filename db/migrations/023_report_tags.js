exports.up = async (knex) => {
  await knex.schema.alterTable('reports', (t) => {
    t.specificType('tags', 'text[]').defaultTo('{}')
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('reports', (t) => {
    t.dropColumn('tags')
  })
}
