exports.up = async (knex) => {
  await knex.schema.table('users', (t) => {
    t.text('brand_color').nullable().defaultTo(null)
    t.boolean('white_label').notNullable().defaultTo(false)
  })
}

exports.down = async (knex) => {
  await knex.schema.table('users', (t) => {
    t.dropColumn('brand_color')
    t.dropColumn('white_label')
  })
}
