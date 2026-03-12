import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(AuthGuard('jwt')) // Protects all routes in this controller
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // 1. Create a new task
  // POST /tasks
  @Post()
  create(@Body() createTaskDto: CreateTaskDto, @Req() req: any) {
    // Extracts the user ID from the JWT token (added by your AuthGuard)
    const userId = req.user.id; 
    return this.tasksService.create(createTaskDto, userId);
  }

  // 2. Get tasks assigned to the currently logged-in user
  // GET /tasks/my-tasks
  // Note: This must be defined BEFORE /:id so NestJS doesn't think "my-tasks" is an ID!
  @Get('my-tasks')
  getMyTasks(@Req() req: any) {
    const userId = req.user.id;
    console.log(`Fetching tasks for user ID: ${userId}`);
    return this.tasksService.findByAssignedUser(userId);
  }

  // 3. Get all tasks (Usually for the Owner/Manager)
  // GET /tasks
  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  // 4. Get a specific task by ID
  // GET /tasks/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  // 5. Update a task's status (Complete, Cancel, etc.)
  // PATCH /tasks/:id/status
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string, 
    @Body() updateTaskDto: UpdateTaskDto
  ) {
    return this.tasksService.updateStatus(id, updateTaskDto);
  }
}