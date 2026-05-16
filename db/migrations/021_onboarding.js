exports.up = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.timestamp('onboarded_at', { useTz: true }).nullable()
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('onboarded_at')
  })
}
