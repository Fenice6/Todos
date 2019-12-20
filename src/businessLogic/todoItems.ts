//Qui creiamo classe che contengono solo la logica di business
import * as uuid from 'uuid'

import { TodoItem } from '../models/TodoItem'
import { TodoAccess } from '../dataLayer/totoAccess'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import { parseUserId } from '../auth/utils'

const todoAccess = new TodoAccess() //la logica di come fisicamente accedere ai dati è nel dataLayer

export async function getAllTodoItems(jwtToken: string): Promise<TodoItem[]> {

  const userId = parseUserId(jwtToken)

  return todoAccess.getTodoItemByUserId(userId)
}

export async function createTodo(
  createTodoRequest: CreateTodoRequest,
  jwtToken: string
): Promise<TodoItem> {

  const itemId = uuid.v4()
  const userId = parseUserId(jwtToken)

  return await todoAccess.createTodoItem({
    todoId: itemId,
    userId: userId,
    name: createTodoRequest.name,
    dueDate: createTodoRequest.dueDate,
    createdAt: new Date().toISOString(),
    done: false
  })
}

export async function updateTodo(
  todoId: string,
  updateTodoRequest: UpdateTodoRequest,
  jwtToken: string
): Promise<TodoItem> {

  parseUserId(jwtToken)
  
  const element = await todoAccess.getTodoItemById({todoId: todoId})

  const res = await todoAccess.updateTodoItem(
  { //Key
    todoId: todoId,
    createdAt: element.createdAt
  },
  { //To Update
    name: updateTodoRequest.name,
    dueDate: updateTodoRequest.dueDate,
    done: updateTodoRequest.done
  })
  return res
}


export async function generateUploadUrl(
  todoId: string,
  jwtToken: string
): Promise<any> {

  parseUserId(jwtToken)
  
  const element = await todoAccess.getTodoItemById({todoId: todoId})


  const uploadUrl = await todoAccess.getUploadUrl(todoId)
  const res = await todoAccess.updateUrlOnTodoItem
  (
    { //Key
      todoId: todoId,
      createdAt: element.createdAt
    }
  )
  console.log(JSON.stringify(res))
  return {newTodoItem: res, uploadUrl: uploadUrl}

}

export async function deleteTodoItem(
  todoId: string,
  jwtToken: string
): Promise<boolean> {

  parseUserId(jwtToken)
  
  const element = await todoAccess.getTodoItemById({todoId: todoId})


  return await todoAccess.deleteTodoItem(element)

}