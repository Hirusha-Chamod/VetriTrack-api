import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ApprovalRequest, ApprovalRequestSchema } from './schemas/request.schema';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    // Registering the schema so it can be injected into the service
    MongooseModule.forFeature([
      { name: ApprovalRequest.name, schema: ApprovalRequestSchema }
    ]),
    AuthModule, 
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}