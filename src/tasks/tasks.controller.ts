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
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('tasks')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // POST /tasks
  @Post()
  @Roles('owner', 'staff')
  create(@Body() createTaskDto: CreateTaskDto, @Req() req: any) {
    const userId = req.user.id; 
    return this.tasksService.create(createTaskDto, userId);
  }

 
  // GET /tasks/my-tasks
  @Get('my-tasks')
  @Roles('owner', 'staff')
  getMyTasks(@Req() req: any) {
    const userId = req.user.id;
    console.log(`Fetching tasks for user ID: ${userId}`);
    return this.tasksService.findByAssignedUser(userId);
  }


  // GET /tasks
  @Get()
  @Roles('owner', 'staff')
  findAll() {
    return this.tasksService.findAll();
  }

 
  // GET /tasks/:id
  @Get(':id')
  @Roles('owner', 'staff')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  // PATCH /tasks/:id/status
  @Patch(':id/status')
  @Roles('owner', 'staff')
  updateStatus(
    @Param('id') id: string, 
    @Body() updateTaskDto: UpdateTaskDto
  ) {
    return this.tasksService.updateStatus(id, updateTaskDto);
  }
}