exports.up = async (knex) => {
  await knex.schema.table('users', (t) => {
    t.text('notify_slack_url').nullable().defaultTo(null)
    t.text('notify_teams_url').nullable().defaultTo(null)
  })
}

exports.down = async (knex) => {
  await knex.schema.table('users', (t) => {
    t.dropColumn('notify_slack_url')
    t.dropColumn('notify_teams_url')
  })
}
