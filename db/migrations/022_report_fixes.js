exports.up = async (knex) => {
  await knex.schema.createTable('report_fixes', (t) => {
    t.increments('id')
    t.integer('report_id').notNullable().references('id').inTable('reports').onDelete('CASCADE')
    t.text('check_name').notNullable()
    t.text('status').notNullable().defaultTo('todo') // 'todo' | 'in_progress' | 'fixed'
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now())
    t.unique(['report_id', 'check_name'])
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('report_fixes')
}
