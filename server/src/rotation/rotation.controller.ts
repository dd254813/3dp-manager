import { Controller, Post, Param } from '@nestjs/common';
import { RotationService } from './rotation.service';

@Controller('rotation')
export class RotationController {
  constructor(private readonly rotationService: RotationService) {}

  @Post('rotate-all')
  async rotateAll() {
    return this.rotationService.performRotation();
  }

  @Post('rotate-one/:id')
  async rotateSingle(@Param('id') id: string) {
    return this.rotationService.rotateSingleSubscription(id);
  }
}
