exports.up = async (knex) => {
  await knex.schema.alterTable('reports', (t) => {
    t.text('notes').nullable()
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('reports', (t) => {
    t.dropColumn('notes')
  })
}
