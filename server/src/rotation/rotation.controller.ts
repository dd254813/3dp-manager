import { Controller, Post } from '@nestjs/common';
import { RotationService } from './rotation.service';

@Controller('rotation')
export class RotationController {
  constructor(private readonly rotationService: RotationService) {}

  @Post('rotate-all')
  async rotateAll() {
    return this.rotationService.performRotation();
  }
}
