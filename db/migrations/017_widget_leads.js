exports.up = async (knex) => {
  await knex.schema.createTable('widget_leads', (t) => {
    t.increments('id')
    t.integer('api_key_id').nullable().references('id').inTable('api_keys').onDelete('CASCADE')
    t.text('email').notNullable()
    t.text('url').notNullable()
    t.integer('score').nullable()
    t.string('grade', 2).nullable()
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now())
  })
  await knex.schema.table('users', (t) => {
    t.boolean('widget_lead_capture').notNullable().defaultTo(false)
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTable('widget_leads')
  await knex.schema.table('users', (t) => {
    t.dropColumn('widget_lead_capture')
  })
}
