exports.up = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.text('digest_frequency').nullable() // 'weekly' | 'monthly' | null
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('digest_frequency')
  })
}
