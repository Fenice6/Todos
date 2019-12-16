//Nel DataLayer implementiamo le classi che incapsulano la logica per lavorano col db
import * as AWS  from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk' //xray sdk
import { DocumentClient } from 'aws-sdk/clients/dynamodb'

const XAWS = AWSXRay.captureAWS(AWS) //istanza dell'sdk xray
const s3 = new XAWS.S3({
  signatureVersion: 'v4'
})

import { TodoItem } from '../models/TodoItem'

export class TodoAccess {

  constructor( //costruttore con due parametri
    private readonly docClient: DocumentClient = createDynamoDBClient(), //permette di lavorare con dynamodb
    private readonly todoTable = process.env.TODOS_TABLE, //nome della tabella dove salvare i dati
    private readonly todoIndex = process.env.TODOS_ID_INDEX, //nome dell'indice della tabella dove i dati vengono salvati
    private readonly bucketName = process.env.TODOS_S3_BUCKET, //nome del bucket dove vengono salvati i dati
    private readonly urlExpiration = process.env.SIGNED_URL_EXPIRATION) { //Dopo quanto deve spirare l'url generato
  }

  async getAllTodoItems(): Promise<TodoItem[]> {
    console.log("Starting createTodoItem");
    const result = await this.docClient.scan({
      TableName: this.todoTable
    }).promise()
    console.log("Completed createTodoItem");

    const items = result.Items
    return items as TodoItem[]
  }

  async createTodoItem(todoItem: TodoItem): Promise<TodoItem> {
    console.log("Starting createTodoItem");
    await this.docClient.put({
      TableName: this.todoTable,
      Item: todoItem
    }).promise()
    console.log("Completed createTodoItem");
    return todoItem
  }

  async updateTodoItem(key: any, toUpdate: any): Promise<TodoItem> {
    console.log("Starting updateTodoItem" );
    const res = await this.docClient.update({
      TableName: this.todoTable,
      Key: key,
      UpdateExpression: 'set #n = :n, #dD = :dD, #d = :d',
      ExpressionAttributeNames: {'#n' : 'name', '#dD' : 'dueDate', '#d' : 'done'},
      ExpressionAttributeValues:{
        ':n' : toUpdate.name,
        ':dD' : toUpdate.dueDate,
        ':d' : toUpdate.done
      },
      ReturnValues: "ALL_NEW" //tutti gli attributi del nuovo elemento
    }).promise()
    console.log("Completed updateTodoItem");

    return res.$response.data as TodoItem
  }

  async updateUrlOnTodoItem(key: any): Promise<TodoItem> {
    console.log("Starting updateUrlOnTodoItem" );
    const res = await this.docClient.update({
      TableName: this.todoTable,
      Key: key,
      UpdateExpression: 'set #u = :u',
      ExpressionAttributeNames: {'#u' : 'attachmentUrl'},
      ExpressionAttributeValues:{
        ':u' : `https://${this.bucketName}.s3.amazonaws.com/${key.todoId}`
      },
      ReturnValues: "ALL_NEW" //tutti gli attributi del nuovo elemento
    }).promise()
    console.log("Completed updateUrlOnTodoItem");

    return res.$response.data as TodoItem
  }

  async getTodoItemById(key: any): Promise<TodoItem> {
    console.log("Starting getTodoItemById");
    const result = await this.docClient.scan({
      TableName: this.todoTable,
      IndexName: this.todoIndex,
      FilterExpression: "todoId = :id",
      ExpressionAttributeValues: {':id': key.todoId}
    }).promise()
    console.log("Completed getTodoItemById");
    console.log("Found " + result.Count + " element (it must be unique)");
    if (result.Count == 0)
      throw new Error('Element not found')
    if (result.Count > 1)
      throw new Error('todoId is not Unique')
    const item = result.Items[0]
    console.log(item);
    return item as TodoItem
  }

  async getUploadUrl(todoId: string): Promise<string> {
    console.log("Starting getUploadUrl");
    const ret = await s3.getSignedUrl('putObject', {
      Bucket: this.bucketName,
      Key: todoId,
      Expires: parseInt(this.urlExpiration) //operatore unario per essere sicuro venga castato a numero
    })
    console.log("Completed getUploadUrl");
    return ret
  }

  async deleteImageS3(todoId: string): Promise<boolean> {
    console.log("Starting deleteImageS3");
    await s3.deleteObject({
      Bucket: this.bucketName,
      Key: todoId
    })
    console.log("Completed deleteImageS3");
    return true
  }

  async getImageS3(todoId: string): Promise<TodoItem> {
    console.log("Starting getImageS3");
    const ret =  await s3.getObject({
      Bucket: this.bucketName,
      Key: todoId
    })
    console.log("Completed getImageS3");
    return ret
  }

  async deleteTodoItem(element: TodoItem): Promise<boolean> {
    console.log("Starting deleteTodoItem");
    if(await this.getImageS3(element.todoId))
      await this.deleteImageS3(element.todoId)
    const result = await this.docClient.delete({
      TableName: this.todoTable,
      Key:
      {
        todoId: element.todoId,
        createdAt: element.createdAt
      }
    }).promise()
    console.log("Completed deleteTodoItem");
    if (result.$response.error)
    {
      console.error(result.$response.error)
      return false
    }
    return true
  }

}

function createDynamoDBClient() { //controlla se siamo in modalità offline tramite una variabile d'ambiente, in tal caso usa i corretti puntamenti per la versione offline
  if (process.env.IS_OFFLINE) {
    console.log('Creating a local DynamoDB instance')
    AWSXRay.setContextMissingStrategy("LOG_ERROR"); //setta un contesto che a volte salta 
    return new XAWS.DynamoDB.DocumentClient({ //Qui dobbiamo usare l'istanxa xray
      region: 'localhost',
      endpoint: 'http://localhost:8000'
    })
  }

  return new XAWS.DynamoDB.DocumentClient()
}
