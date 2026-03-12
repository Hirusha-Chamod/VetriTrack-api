import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<Task>,
  ) {}

  // Helper method to format the Mongoose document to match your Frontend UI interface
  private formatTask(taskDoc: any) {
    return {
      id: taskDoc._id.toString(),
      title: taskDoc.title,
      description: taskDoc.description,
      status: taskDoc.status,
      priority: taskDoc.priority,
      taskType: taskDoc.taskType,
      dueDate: taskDoc.dueDate,
      createdAt: taskDoc.createdAt,
      cancelReason: taskDoc.cancelReason,
      // Safely extract the names from the populated User documents
      assignedTo: taskDoc.assignedTo?._id?.toString() || taskDoc.assignedTo,
      assignedToName: taskDoc.assignedTo?.fullName || 'Unknown User',
      createdBy: taskDoc.createdBy?._id?.toString() || taskDoc.createdBy,
      createdByName: taskDoc.createdBy?.fullName || 'System',
      // Linked records
      linkedRecordType: taskDoc.linkedRecordType,
      linkedRecordId: taskDoc.linkedRecordId?.toString(),
      linkedRecordName: taskDoc.linkedRecordName,
    };
  }

  // 1. Create a new task
  async create(createTaskDto: CreateTaskDto, userId: string) {
    const newTask = await this.taskModel.create({
      ...createTaskDto,
      createdBy: new Types.ObjectId(userId), // Set the creator automatically from the JWT token
    });

    // Populate and return formatted task
    const populatedTask = await newTask.populate([
      { path: 'assignedTo', select: 'fullName' },
      { path: 'createdBy', select: 'fullName' }
    ]);

    return this.formatTask(populatedTask);
  }

  // 2. Get ALL tasks (For the Owner/Manager)
  async findAll() {
    const tasks = await this.taskModel
      .find()
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .sort({ dueDate: 1 }) // Sort by closest due date first
      .exec();

    return tasks.map(task => this.formatTask(task));
  }

  // 3. Get tasks assigned to a specific user (For Staff Dashboard)
  async findByAssignedUser(userId: string) {
    const tasks = await this.taskModel
      .find({ assignedTo: userId }) 
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .sort({ dueDate: 1 })
      .exec();
      
    console.log(`Found ${tasks.length} tasks for user ID: ${userId}`);
    return tasks.map(task => this.formatTask(task));
  }

  // 4. Get a single task by ID
  async findOne(id: string) {
    const task = await this.taskModel
      .findById(id)
      .populate('assignedTo', 'fullName')
      .populate('createdBy', 'fullName')
      .exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return this.formatTask(task);
  }

  // 5. Update task status (Complete, Cancel, etc.)
  async updateStatus(id: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.taskModel.findByIdAndUpdate(
      id,
      { $set: updateTaskDto },
      { new: true }
    )
    .populate('assignedTo', 'fullName')
    .populate('createdBy', 'fullName')
    .exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return this.formatTask(task);
  }
}