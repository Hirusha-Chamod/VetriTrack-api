import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role-Based Access Control (RBAC) Security Guard.
 * Intercepts incoming HTTP requests and ensures the authenticated user 
 * has the specific privileges required to execute the target endpoint.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    /*
     * Step 1: Extract Security Metadata.
     * Uses the NestJS Reflector to read the @Roles() decorator attached to the route handler or class.
     */
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    /*
     * Step 2: Unrestricted Bypass.
     * If no specific roles were explicitly defined by the developer, the route is 
     * considered accessible to any authenticated user.
     */
    if (!requiredRoles) return true; 

    /*
     * Step 3: Extract Authenticated Payload.
     * At this point in the lifecycle, the AuthGuard has already validated the JWT 
     * and attached the decoded user object to the incoming request.
     */
    const { user } = context.switchToHttp().getRequest();
    
    /*
     * Step 4: Execute Authorization Check.
     * Verify that the user exists and that their assigned role matches one of the 
     * permitted roles for this endpoint.
     */
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    
    // Authorization successful, permit the request to hit the controller
    return true;
  }
}